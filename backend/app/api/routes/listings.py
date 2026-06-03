import json
from html import escape
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_premium_user
from app.core.ratelimit import limiter
from app.models.user import User, Listing, Interest, Message
from app.services.scryfall import get_cards_bulk, get_card_by_id, extract_card_summary
from app.services.email import send_email

router = APIRouter()

MAX_PHOTO_LEN = 700_000   # ~512 KB image as base64
MAX_TEXT_LEN = 500


class WantedCard(BaseModel):
    id: str
    name: str
    image_small: Optional[str] = None


class ListingRequest(BaseModel):
    scryfall_id: str
    condition: str = "NM"
    foil: bool = False
    price: Optional[float] = None
    accepts_offers: bool = False
    wanted: Optional[str] = None
    wanted_cards: Optional[List[WantedCard]] = None
    photo: Optional[str] = None
    notes: Optional[str] = None


class InterestRequest(BaseModel):
    message: Optional[str] = None


def _seller(u: Optional[User]) -> dict:
    return {"username": u.username, "avatar": u.avatar, "display_name": u.display_name} if u else None


async def _serialize(db: AsyncSession, rows, cards: dict) -> list:
    out = []
    sellers: dict[int, User] = {}
    for l in rows:
        if l.user_id not in sellers:
            sellers[l.user_id] = (await db.execute(select(User).where(User.id == l.user_id))).scalar_one_or_none()
        raw = cards.get(l.scryfall_id)
        card = extract_card_summary(raw) if raw else {"id": l.scryfall_id, "name": "?"}
        try:
            wanted_cards = json.loads(l.wanted_cards) if l.wanted_cards else []
        except Exception:
            wanted_cards = []
        out.append({
            "id": l.id, "scryfall_id": l.scryfall_id, "condition": l.condition, "foil": l.foil,
            "price": l.price, "accepts_offers": bool(l.accepts_offers),
            "wanted": l.wanted, "wanted_cards": wanted_cards,
            "photo": l.photo, "notes": l.notes,
            "status": l.status, "resolved_as": l.resolved_as,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "card": card, "seller": _seller(sellers[l.user_id]),
        })
    return out


@router.get("")
async def browse(
    q: Optional[str] = None,
    page: int = 1,
    per_page: int = 24,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Public marketplace of active listings (auth required to browse)."""
    rows = (await db.execute(
        select(Listing).where(Listing.status == "active").order_by(desc(Listing.created_at))
    )).scalars().all()
    cards = await get_cards_bulk([l.scryfall_id for l in rows])
    items = await _serialize(db, rows, cards)
    if q:
        ql = q.lower()
        items = [i for i in items if ql in (i["card"].get("name", "").lower())]
    total = len(items)
    start = (page - 1) * per_page
    return {"items": items[start:start + per_page], "total": total, "page": page,
            "pages": (total + per_page - 1) // per_page if per_page else 1}


@router.get("/mine")
async def my_listings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Listing).where(Listing.user_id == current_user.id).order_by(desc(Listing.created_at))
    )).scalars().all()
    cards = await get_cards_bulk([l.scryfall_id for l in rows])
    items = await _serialize(db, rows, cards)
    # attach interest counts
    for it, l in zip(items, rows):
        cnt = (await db.execute(select(Interest).where(Interest.listing_id == l.id))).scalars().all()
        it["interests"] = len(cnt)
    return items


@router.post("", status_code=201)
async def create_listing(data: ListingRequest, premium: User = Depends(get_premium_user), db: AsyncSession = Depends(get_db)):
    wanted_text = (data.wanted or "").strip()
    wanted_cards = data.wanted_cards or []
    has_trade = bool(wanted_text or wanted_cards)
    if data.price is None and not has_trade:
        raise HTTPException(status_code=400, detail="Defina um preço ou o que deseja em troca")
    if data.price is not None and (data.price < 0 or data.price > 1_000_000):
        raise HTTPException(status_code=400, detail="Preço inválido")
    if data.photo and len(data.photo) > MAX_PHOTO_LEN:
        raise HTTPException(status_code=400, detail="Foto muito grande (máx. ~512 KB)")
    try:
        await get_card_by_id(data.scryfall_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Carta não encontrada")

    # Keep only id/name/image for each wanted card (cap the list).
    wc = [{"id": c.id, "name": c.name[:120], "image_small": (c.image_small or None)} for c in wanted_cards[:30]]

    l = Listing(
        user_id=premium.id, scryfall_id=data.scryfall_id, condition=data.condition.upper()[:3],
        foil=data.foil, price=data.price,
        accepts_offers=bool(data.accepts_offers) if data.price is not None else False,
        wanted=(wanted_text[:MAX_TEXT_LEN] or None),
        wanted_cards=(json.dumps(wc) if wc else None),
        photo=(data.photo or None),
        notes=((data.notes or "").strip()[:MAX_TEXT_LEN] or None),
    )
    db.add(l)
    await db.flush()
    return {"id": l.id}


@router.delete("/{listing_id}", status_code=204)
async def delete_listing(listing_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.user_id == current_user.id))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Não encontrado")
    await db.delete(l)


@router.patch("/{listing_id}/status")
async def set_status(listing_id: int, status: str = Query(...), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.user_id == current_user.id))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Não encontrado")
    l.status = "closed" if status == "closed" else "active"
    if l.status == "active":
        l.resolved_as = None  # reopening clears the resolution
    return {"status": l.status}


@router.patch("/{listing_id}/resolve")
async def resolve_listing(listing_id: int, outcome: str = Query(...), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Owner marks how the deal ended. sold/traded removes it from the market;
    cancelled keeps the card listed (the deal simply fell through)."""
    if outcome not in ("sold", "traded", "cancelled"):
        raise HTTPException(status_code=400, detail="Resultado inválido")
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.user_id == current_user.id))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if outcome == "cancelled":
        l.status = "active"
        l.resolved_as = None
    else:
        l.status = "resolved"
        l.resolved_as = outcome
    return {"status": l.status, "resolved_as": l.resolved_as}


async def _load_thread(db: AsyncSession, interest_id: int, user: User):
    """Load an interest + its listing, ensuring the user is a participant."""
    interest = (await db.execute(select(Interest).where(Interest.id == interest_id))).scalar_one_or_none()
    if not interest:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    listing = (await db.execute(select(Listing).where(Listing.id == interest.listing_id))).scalar_one_or_none()
    if not listing or user.id not in (interest.buyer_id, listing.user_id):
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return interest, listing


@router.get("/conversations")
async def my_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Every negotiation the user is part of, as buyer or as seller."""
    my_listing_ids = [r[0] for r in (await db.execute(
        select(Listing.id).where(Listing.user_id == current_user.id)
    )).all()]
    interests = (await db.execute(
        select(Interest).where(
            or_(Interest.buyer_id == current_user.id, Interest.listing_id.in_(my_listing_ids or [-1]))
        ).order_by(desc(Interest.created_at))
    )).scalars().all()

    listings = {l.id: l for l in (await db.execute(
        select(Listing).where(Listing.id.in_([i.listing_id for i in interests] or [-1]))
    )).scalars().all()}
    cards = await get_cards_bulk([l.scryfall_id for l in listings.values()])
    user_ids = {i.buyer_id for i in interests} | {l.user_id for l in listings.values()}
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(user_ids or [-1])))).scalars().all()}
    last = {}
    for m in (await db.execute(
        select(Message).where(Message.interest_id.in_([i.id for i in interests] or [-1])).order_by(Message.created_at)
    )).scalars().all():
        last[m.interest_id] = m

    out = []
    for i in interests:
        l = listings.get(i.listing_id)
        if not l:
            continue
        raw = cards.get(l.scryfall_id)
        seller = users.get(l.user_id)
        buyer = users.get(i.buyer_id)
        i_am_seller = l.user_id == current_user.id
        other = seller if not i_am_seller else buyer
        lm = last.get(i.id)
        out.append({
            "interest_id": i.id, "listing_id": l.id, "status": i.status,
            "role": "seller" if i_am_seller else "buyer",
            "card": extract_card_summary(raw) if raw else {"id": l.scryfall_id, "name": "?"},
            "other": _seller(other),
            "last_message": (lm.body[:80] if lm else (i.message[:80] if i.message else None)),
            "last_at": (lm.created_at if lm else i.created_at).isoformat(),
        })
    out.sort(key=lambda c: c["last_at"], reverse=True)
    return out


@router.get("/interest/{interest_id}/messages")
async def get_thread(interest_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    interest, listing = await _load_thread(db, interest_id, current_user)
    msgs = (await db.execute(
        select(Message).where(Message.interest_id == interest_id).order_by(Message.created_at)
    )).scalars().all()
    raw = (await get_cards_bulk([listing.scryfall_id])).get(listing.scryfall_id)
    thread = []
    # The buyer's original note is the first message in the thread.
    if interest.message:
        thread.append({"id": 0, "sender_id": interest.buyer_id, "body": interest.message,
                       "created_at": interest.created_at.isoformat()})
    thread += [{"id": m.id, "sender_id": m.sender_id, "body": m.body,
                "created_at": m.created_at.isoformat()} for m in msgs]
    return {
        "interest_id": interest.id, "status": interest.status,
        "role": "seller" if listing.user_id == current_user.id else "buyer",
        "is_owner": listing.user_id == current_user.id,
        "listing": {"id": listing.id, "status": listing.status, "resolved_as": listing.resolved_as,
                    "card": extract_card_summary(raw) if raw else {"id": listing.scryfall_id, "name": "?"}},
        "messages": thread,
    }


@router.post("/interest/{interest_id}/messages", status_code=201)
@limiter.limit("30/minute")
async def send_message(request: Request, interest_id: int, data: InterestRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    interest, listing = await _load_thread(db, interest_id, current_user)
    body = (data.message or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    m = Message(interest_id=interest_id, sender_id=current_user.id, body=body[:2000])
    db.add(m)
    await db.flush()
    return {"id": m.id}


@router.patch("/interest/{interest_id}/resolve")
async def resolve_thread(interest_id: int, outcome: str = Query(...), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Seller closes a negotiation. sold/traded removes the listing from the
    market; cancelled keeps it live for other buyers."""
    if outcome not in ("sold", "traded", "cancelled"):
        raise HTTPException(status_code=400, detail="Resultado inválido")
    interest, listing = await _load_thread(db, interest_id, current_user)
    if listing.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o vendedor pode finalizar")
    interest.status = outcome
    if outcome == "cancelled":
        listing.status = "active"
        listing.resolved_as = None
    else:
        listing.status = "resolved"
        listing.resolved_as = outcome
    return {"status": interest.status, "listing_status": listing.status}


@router.get("/stats")
async def platform_stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Platform-wide totals of completed deals (shown on the Trades page)."""
    sold = (await db.execute(select(func.count(Listing.id)).where(Listing.resolved_as == "sold"))).scalar() or 0
    traded = (await db.execute(select(func.count(Listing.id)).where(Listing.resolved_as == "traded"))).scalar() or 0
    active = (await db.execute(select(func.count(Listing.id)).where(Listing.status == "active"))).scalar() or 0
    return {"sold": sold, "traded": traded, "active": active}


@router.post("/{listing_id}/interest", status_code=201)
@limiter.limit("20/hour")
async def express_interest(request: Request, listing_id: int, data: InterestRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.status == "active"))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Oferta não encontrada")
    if l.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="É sua própria oferta")

    # One interest per buyer per listing (avoids spamming the seller's inbox).
    already = (await db.execute(select(Interest).where(
        Interest.listing_id == listing_id, Interest.buyer_id == current_user.id
    ))).scalar_one_or_none()
    if already:
        return {"message": "Você já demonstrou interesse nesta oferta."}

    message = (data.message or "").strip()[:MAX_TEXT_LEN] or None
    db.add(Interest(listing_id=listing_id, buyer_id=current_user.id, message=message))
    await db.flush()

    # Notify the seller by email (best-effort). All user-supplied values are
    # HTML-escaped so they can't inject markup into the email.
    seller = (await db.execute(select(User).where(User.id == l.user_id))).scalar_one_or_none()
    try:
        card = extract_card_summary(await get_card_by_id(l.scryfall_id))
        cardname = card.get("name", "carta")
    except Exception:
        cardname = "sua carta"
    if seller and seller.email:
        uname = escape(current_user.username)
        cname = escape(cardname)
        body = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#b8860b">📖 VaultSpell</h2>
          <p><b>{uname}</b> tem interesse na sua oferta de <b>{cname}</b>.</p>
          {f'<p style="background:#f5f5f5;padding:10px;border-radius:8px">{escape(message)}</p>' if message else ''}
          <p style="color:#666;font-size:13px">Veja o perfil: vaultspell.com/u/{uname}</p>
        </div>"""
        await send_email(seller.email, f"Interesse na sua carta — {cardname}", body)

    return {"message": "Interesse enviado! O vendedor foi avisado."}


@router.get("/{listing_id}/interests")
async def list_interests(listing_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.user_id == current_user.id))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Não encontrado")
    rows = (await db.execute(select(Interest).where(Interest.listing_id == listing_id).order_by(desc(Interest.created_at)))).scalars().all()
    out = []
    for it in rows:
        b = (await db.execute(select(User).where(User.id == it.buyer_id))).scalar_one_or_none()
        out.append({"id": it.id, "message": it.message, "buyer": _seller(b),
                    "created_at": it.created_at.isoformat() if it.created_at else None})
    return out
