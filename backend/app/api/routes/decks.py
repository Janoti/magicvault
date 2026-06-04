import re
import logging
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_premium_user
from sqlalchemy import or_, and_
from app.models.user import User, Deck, DeckCard, WishlistEntry, CollectionEntry, Friendship
from app.services.scryfall import get_sets, get_card_by_id, extract_card_summary, get_cards_bulk
from app.services import deck_doctor
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)
router = APIRouter()


async def _viewable_deck(db: AsyncSession, deck_id: int, user: User) -> Deck:
    """A deck the user may look at: their own, or any public deck."""
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one_or_none()
    if not deck or (deck.user_id != user.id and not deck.is_public):
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


# --- Deck analysis helpers (heuristics over Scryfall oracle text) ---
_TYPE_ORDER = ["Creature", "Planeswalker", "Instant", "Sorcery", "Artifact", "Enchantment", "Battle", "Land"]


def _primary_type(type_line: str) -> str:
    tl = type_line or ""
    for t in _TYPE_ORDER:
        if t in tl:
            return t
    return "Other"


def _categorize(text: str, type_line: str, power) -> list:
    """Tag a card with deck roles. A card can have more than one role."""
    t = (text or "").lower()
    tl = (type_line or "").lower()
    cats = []
    if "land" in tl and "creature" not in tl:
        return ["land"]
    if ("add {" in t or "add one mana" in t or "add two mana" in t
            or ("search your library for" in t and "land" in t)
            or "mana of any color" in t):
        cats.append("ramp")
    if "draw a card" in t or "draw two cards" in t or "draw three cards" in t or "draw cards" in t or "draw that many cards" in t:
        cats.append("draw")
    if any(p in t for p in ["destroy all", "exile all", "destroy each", "all creatures get -", "to each creature", "each player sacrifices"]):
        cats.append("wipe")
    elif any(p in t for p in ["destroy target", "exile target", "damage to target creature", "damage to any target",
                              "target creature gets -", "fight target", "target creature you don't control", "tap target"]):
        cats.append("removal")
    if "counter target" in t or "return target" in t and "to its owner" in t:
        cats.append("interaction")
    try:
        pw = int(power)
    except (TypeError, ValueError):
        pw = 0
    if "win the game" in t or "can't be blocked" in t or "deals damage equal to" in t or pw >= 6:
        cats.append("finisher")
    return cats or ["other"]


@router.get("/{deck_id}/analysis")
async def deck_analysis(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mana curve, color balance, type spread and role breakdown for a deck."""
    deck = await _viewable_deck(db, deck_id, current_user)

    rows = (await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id, DeckCard.is_sideboard == False))).scalars().all()  # noqa: E712
    cards = await get_cards_bulk([dc.scryfall_id for dc in rows])

    curve = {k: 0 for k in ["0", "1", "2", "3", "4", "5", "6", "7+"]}
    colors = {c: 0 for c in ["W", "U", "B", "R", "G", "C"]}
    types: dict = {}
    categories = {k: 0 for k in ["ramp", "draw", "removal", "wipe", "interaction", "finisher", "land", "other"]}
    total = lands = nonlands = 0
    cmc_sum = 0.0

    for dc in rows:
        raw = cards.get(dc.scryfall_id)
        if not raw:
            continue
        c = extract_card_summary(raw)
        qty = dc.quantity
        total += qty
        tl = c.get("type_line", "")
        is_land = "Land" in tl and "Creature" not in tl

        ptype = _primary_type(tl)
        types[ptype] = types.get(ptype, 0) + qty

        # Mana pips by color (from mana cost)
        for sym in re.findall(r"\{([^}]+)\}", c.get("mana_cost") or ""):
            for ch in sym.split("/"):
                if ch in colors:
                    colors[ch] += qty

        if is_land:
            lands += qty
        else:
            nonlands += qty
            cmc = int(c.get("cmc") or 0)
            curve["7+" if cmc >= 7 else str(cmc)] += qty
            cmc_sum += (c.get("cmc") or 0) * qty

        for cat in _categorize(c.get("oracle_text", ""), tl, c.get("power")):
            if cat in categories:
                categories[cat] += qty

    return {
        "name": deck.name, "format": deck.format,
        "total": total, "lands": lands, "nonlands": nonlands,
        "avg_cmc": round(cmc_sum / nonlands, 2) if nonlands else 0,
        "curve": [{"cmc": k, "count": v} for k, v in curve.items()],
        "colors": colors,
        "types": types,
        "categories": categories,
    }


@router.get("/doctor/status")
async def doctor_status():
    """Public: whether the AI Deck Doctor is configured (so the UI can hide it)."""
    return {"configured": deck_doctor.is_configured()}


@router.post("/{deck_id}/doctor")
async def deck_doctor_run(deck_id: int, lang: str = "en", refresh: bool = False, premium: User = Depends(get_premium_user), db: AsyncSession = Depends(get_db)):
    """Premium: AI review of the deck, grounded in the real card data. Cached per
    deck content + language (only re-calls the model when the deck changes or on
    an explicit refresh)."""
    if not deck_doctor.is_configured():
        raise HTTPException(status_code=503, detail="IA ainda não configurada")
    deck = await _viewable_deck(db, deck_id, premium)
    analysis = await deck_analysis(deck_id, premium, db)

    rows = (await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id, DeckCard.is_sideboard == False))).scalars().all()  # noqa: E712
    if not rows:
        raise HTTPException(status_code=400, detail="Deck vazio")
    cards_raw = await get_cards_bulk([dc.scryfall_id for dc in rows])
    cards = []
    for dc in rows:
        raw = cards_raw.get(dc.scryfall_id)
        c = extract_card_summary(raw) if raw else {"name": "?", "type_line": "", "cmc": 0}
        cards.append({"qty": dc.quantity, "name": c.get("name", "?"),
                      "type": c.get("type_line", ""), "cmc": int(c.get("cmc") or 0)})

    # Cache key changes whenever the decklist changes → auto-invalidation.
    sig = hashlib.sha1(("|".join(sorted(f"{c['qty']}x{c['name']}" for c in cards))).encode()).hexdigest()[:16]
    cache_key = f"doctor:{deck_id}:{lang}:{sig}"
    if not refresh:
        cached = await cache_get(cache_key)
        if cached:
            return {"text": cached, "cached": True}

    try:
        text = await deck_doctor.run_doctor(
            {"name": deck.name, "format": deck.format}, analysis, cards, lang=lang,
        )
    except Exception as e:
        logger.error("Deck Doctor failed: %s", e)
        raise HTTPException(status_code=502, detail="Erro ao consultar a IA")
    await cache_set(cache_key, text, ttl=60 * 60 * 24 * 14)  # 14 days
    return {"text": text, "cached": False}


@router.get("/{deck_id}/coverage")
async def deck_coverage(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """How much of this deck the user already owns (matched by card name)."""
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    deck_cards = (await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id))).scalars().all()
    coll = (await db.execute(select(CollectionEntry).where(CollectionEntry.user_id == current_user.id))).scalars().all()

    # Resolve all involved cards in one batch (cached) to get names + prices.
    ids = list({dc.scryfall_id for dc in deck_cards} | {e.scryfall_id for e in coll})
    cards = await get_cards_bulk(ids)

    def name_of(sid):
        c = cards.get(sid)
        return (c.get("name", "").lower() if c else sid)

    # Owned quantity per card name (any printing counts).
    owned_by_name: dict[str, int] = {}
    for e in coll:
        owned_by_name[name_of(e.scryfall_id)] = owned_by_name.get(name_of(e.scryfall_id), 0) + e.quantity

    remaining = dict(owned_by_name)  # allocate owned across duplicate-named deck entries
    rows = []
    tot_needed = tot_owned = tot_missing = 0
    missing_cost = 0.0
    for dc in deck_cards:
        nm = name_of(dc.scryfall_id)
        have = remaining.get(nm, 0)
        allocated = min(dc.quantity, have)
        remaining[nm] = have - allocated
        missing = dc.quantity - allocated
        summary = extract_card_summary(cards[dc.scryfall_id]) if cards.get(dc.scryfall_id) else {"id": dc.scryfall_id, "name": "?"}
        tot_needed += dc.quantity
        tot_owned += allocated
        tot_missing += missing
        missing_cost += missing * (summary.get("price_usd") or 0)
        rows.append({
            "card": summary, "needed": dc.quantity, "owned": allocated, "missing": missing,
            "is_sideboard": dc.is_sideboard, "is_commander": dc.is_commander,
        })

    return {
        "summary": {
            "needed": tot_needed, "owned": tot_owned, "missing": tot_missing,
            "percent": round(100 * tot_owned / tot_needed) if tot_needed else 100,
            "missing_cost": round(missing_cost, 2),
        },
        "cards": rows,
    }


class CreateDeckRequest(BaseModel):
    name: str
    format: str = "casual"
    description: Optional[str] = None
    is_public: bool = False


class AddDeckCardRequest(BaseModel):
    scryfall_id: str
    quantity: int = 1
    is_sideboard: bool = False
    is_commander: bool = False


def _art_crop(raw: dict) -> Optional[str]:
    iu = raw.get("image_uris") or {}
    if not iu and raw.get("card_faces"):
        iu = raw["card_faces"][0].get("image_uris", {})
    return iu.get("art_crop") or iu.get("normal")


@router.get("")
async def list_decks(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deck).where(Deck.user_id == current_user.id).order_by(Deck.updated_at.desc())
    )
    decks = result.scalars().all()

    # A representative card art for each deck (used as a faded cover background).
    first_card: dict = {}
    for d in decks:
        dc = (await db.execute(
            select(DeckCard).where(DeckCard.deck_id == d.id).order_by(DeckCard.is_commander.desc(), DeckCard.id).limit(1)
        )).scalar_one_or_none()
        if dc:
            first_card[d.id] = dc.scryfall_id
    covers = await get_cards_bulk(list(set(first_card.values()))) if first_card else {}

    items = []
    for d in decks:
        count_r = await db.execute(select(func.sum(DeckCard.quantity)).where(DeckCard.deck_id == d.id))
        raw = covers.get(first_card.get(d.id))
        items.append({
            "id": d.id, "name": d.name, "format": d.format,
            "description": d.description, "is_public": d.is_public,
            "card_count": count_r.scalar() or 0,
            "cover": _art_crop(raw) if raw else None,
            "created_at": d.created_at.isoformat(),
        })
    return items


@router.post("", status_code=201)
async def create_deck(data: CreateDeckRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deck = Deck(user_id=current_user.id, name=data.name, format=data.format, description=data.description, is_public=data.is_public)
    db.add(deck)
    await db.flush()
    return {"id": deck.id, "name": deck.name}


class ImportDeckRequest(BaseModel):
    name: str
    format: str = "casual"
    list: str  # pasted decklist text


_CARD_LINE = re.compile(r"^\s*(\d+)\s*[xX]?\s+(.+?)\s*$")


@router.post("/import", status_code=201)
async def import_deck(data: ImportDeckRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a deck from a pasted decklist (e.g. '4 Lightning Bolt'). Handles
    Sideboard/Commander section headers and Moxfield/Arena set annotations."""
    deck = Deck(user_id=current_user.id, name=data.name[:120], format=data.format[:30])
    db.add(deck)
    await db.flush()

    section = "main"  # main | sideboard | commander
    resolved: dict = {}  # name_lower -> scryfall_id or None (cache lookups)
    added = skipped = 0
    errors = []

    for raw in data.list.splitlines()[:400]:
        line = raw.strip()
        if not line or line.startswith(("//", "#")):
            continue
        low = line.lower().rstrip(":")
        if low in ("sideboard", "sb"):
            section = "sideboard"; continue
        if low in ("commander", "commanders"):
            section = "commander"; continue
        if low in ("deck", "mainboard", "main"):
            section = "main"; continue

        m = _CARD_LINE.match(line)
        if not m:
            # A bare card name with no quantity → treat as 1.
            qty, name = 1, line
        else:
            qty, name = int(m.group(1)), m.group(2)
        qty = max(1, min(qty, 99))
        # Strip trailing set/collector annotations: "(C21) 263 *F*", "[LEA]", etc.
        name = re.sub(r"\s*[\(\[].*$", "", name).strip()
        if not name:
            continue

        key = name.lower()
        if key not in resolved:
            try:
                card = await get_card_by_name(name, fuzzy=True)
                resolved[key] = card["id"]
            except Exception:
                resolved[key] = None
        sid = resolved[key]
        if not sid:
            skipped += 1
            errors.append(f"Não encontrada: {name}")
            continue

        db.add(DeckCard(
            deck_id=deck.id, scryfall_id=sid, quantity=qty,
            is_sideboard=(section == "sideboard"),
            is_commander=(section == "commander"),
        ))
        added += 1

    await db.flush()
    return {"id": deck.id, "name": deck.name, "added": added, "skipped": skipped, "errors": errors[:20]}


@router.get("/compare-options")
async def compare_options(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Decks the user can compare against: their own, friends' public decks, and
    other people's public decks."""
    async def _serialize(decks, owners=None):
        out = []
        for d in decks:
            cnt = (await db.execute(select(func.sum(DeckCard.quantity)).where(DeckCard.deck_id == d.id))).scalar() or 0
            out.append({"id": d.id, "name": d.name, "format": d.format, "card_count": cnt,
                        "owner": owners.get(d.user_id) if owners else None})
        return out

    mine = (await db.execute(select(Deck).where(Deck.user_id == current_user.id).order_by(Deck.updated_at.desc()))).scalars().all()

    # Accepted friends
    fr = (await db.execute(select(Friendship).where(
        Friendship.status == "accepted",
        or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id),
    ))).scalars().all()
    friend_ids = [f.addressee_id if f.requester_id == current_user.id else f.requester_id for f in fr]

    friend_decks = (await db.execute(select(Deck).where(
        Deck.is_public == True, Deck.user_id.in_(friend_ids or [-1])  # noqa: E712
    ).order_by(Deck.updated_at.desc()))).scalars().all() if friend_ids else []

    public_decks = (await db.execute(select(Deck).where(
        Deck.is_public == True, Deck.user_id != current_user.id,
        Deck.user_id.notin_(friend_ids or [-1]),
    ).order_by(Deck.updated_at.desc()).limit(30))).scalars().all()  # noqa: E712

    owner_ids = {d.user_id for d in friend_decks} | {d.user_id for d in public_decks}
    owners = {u.id: u.username for u in (await db.execute(select(User).where(User.id.in_(owner_ids or [-1])))).scalars().all()}

    return {
        "mine": await _serialize(mine),
        "friends": await _serialize(friend_decks, owners),
        "public": await _serialize(public_decks, owners),
    }


@router.get("/{deck_id}")
async def get_deck(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards_r = await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id))
    cards = []
    for dc in cards_r.scalars().all():
        try:
            card = extract_card_summary(await get_card_by_id(dc.scryfall_id))
            cats = _categorize(card.get("oracle_text", ""), card.get("type_line", ""), card.get("power"))
        except Exception:
            card = {"id": dc.scryfall_id}
            cats = ["other"]
        # The most informative role for the card (skip the generic ones for the tag).
        primary = next((c for c in cats if c not in ("other", "land")), cats[0] if cats else "other")
        cards.append({"id": dc.id, "quantity": dc.quantity, "is_sideboard": dc.is_sideboard,
                      "is_commander": dc.is_commander, "card": card, "role": primary})

    return {"id": deck.id, "name": deck.name, "format": deck.format,
            "description": deck.description, "is_public": deck.is_public, "cards": cards}


class UpdateDeckRequest(BaseModel):
    name: Optional[str] = None
    format: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


@router.patch("/{deck_id}")
async def update_deck(deck_id: int, data: UpdateDeckRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    if data.name is not None:
        deck.name = data.name[:120]
    if data.format is not None:
        deck.format = data.format[:30]
    if data.description is not None:
        deck.description = data.description or None
    if data.is_public is not None:
        deck.is_public = data.is_public
    return {"id": deck.id, "is_public": deck.is_public}


@router.post("/{deck_id}/cards", status_code=201)
async def add_to_deck(deck_id: int, data: AddDeckCardRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Deck not found")
    dc = DeckCard(deck_id=deck_id, scryfall_id=data.scryfall_id, quantity=data.quantity, is_sideboard=data.is_sideboard, is_commander=data.is_commander)
    db.add(dc)
    await db.flush()
    return {"id": dc.id}


@router.delete("/{deck_id}", status_code=204)
async def delete_deck(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    await db.delete(deck)
