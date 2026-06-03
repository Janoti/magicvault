import json
from html import escape
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_premium_user
from app.core.ratelimit import limiter
from app.models.user import User, Listing, Interest
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
    """Owner marks how the deal ended: sold, traded or cancelled."""
    if outcome not in ("sold", "traded", "cancelled"):
        raise HTTPException(status_code=400, detail="Resultado inválido")
    l = (await db.execute(select(Listing).where(Listing.id == listing_id, Listing.user_id == current_user.id))).scalar_one_or_none()
    if not l:
        raise HTTPException(status_code=404, detail="Não encontrado")
    l.status = "resolved"
    l.resolved_as = outcome
    return {"status": l.status, "resolved_as": l.resolved_as}


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
