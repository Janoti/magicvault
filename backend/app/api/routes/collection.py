from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import csv
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, CollectionEntry, Binder, BinderCard, Listing, CollectionSnapshot
from app.services.scryfall import get_card_by_id, extract_card_summary, get_card_by_name, get_cards_bulk
from app.services.sharing import build_resource_view

router = APIRouter()


# --- grimdeck CSV helpers ---
# grimdeck columns: name, set_code, collector_number, scryfall_id, quantity,
# condition, finish, language, signed, altered, artist_proof, misprint, proxy,
# notes, acquired_date, acquired_price
CSV_COLUMNS = [
    "name", "set_code", "collector_number", "scryfall_id", "quantity",
    "condition", "finish", "language", "signed", "altered", "artist_proof",
    "misprint", "proxy", "notes", "acquired_date", "acquired_price",
]

_LANGUAGE_MAP = {
    "english": "en", "en": "en",
    "portuguese": "pt", "português": "pt", "pt": "pt", "pt-br": "pt",
    "spanish": "es", "español": "es", "es": "es",
    "french": "fr", "français": "fr", "fr": "fr",
    "german": "de", "deutsch": "de", "de": "de",
    "italian": "it", "italiano": "it", "it": "it",
    "japanese": "ja", "日本語": "ja", "ja": "ja", "jp": "ja",
    "korean": "ko", "ko": "ko",
    "russian": "ru", "ru": "ru",
    "chinese simplified": "zhs", "chinese": "zh", "zhs": "zhs", "zht": "zht", "zh": "zh",
}


def _norm_language(value: Optional[str]) -> str:
    if not value:
        return "en"
    return _LANGUAGE_MAP.get(value.strip().lower(), value.strip().lower()[:10])


def _finish_to_foil(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in ("foil", "etched")


def _foil_to_finish(foil: bool) -> str:
    return "foil" if foil else "nonfoil"


class AddCardRequest(BaseModel):
    scryfall_id: str
    quantity: int = 1
    condition: str = "NM"
    foil: bool = False
    language: str = "en"
    notes: Optional[str] = None


class UpdateCardRequest(BaseModel):
    quantity: Optional[int] = None
    condition: Optional[str] = None
    foil: Optional[bool] = None
    notes: Optional[str] = None
    scryfall_id: Optional[str] = None  # change the printing/edition in place


@router.get("/public/{username}")
async def public_collection(username: str, db: AsyncSession = Depends(get_db)):
    """Read-only view of a user's collection, if they made it public (no auth)."""
    user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not user or not user.collection_public:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")
    return await build_resource_view(db, user.id, "collection", None)


@router.get("/stats")
async def stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            func.count(CollectionEntry.id).label("unique_cards"),
            func.sum(CollectionEntry.quantity).label("total_cards"),
        ).where(CollectionEntry.user_id == current_user.id)
    )
    row = result.one()

    # Live total value (USD): resolve every card once (batched + cached) and sum
    # price × quantity, using the foil price for foil entries.
    entries = (await db.execute(
        select(CollectionEntry).where(CollectionEntry.user_id == current_user.id)
    )).scalars().all()
    total_value = 0.0
    if entries:
        cards = await get_cards_bulk([e.scryfall_id for e in entries])
        for e in entries:
            raw = cards.get(e.scryfall_id)
            if not raw:
                continue
            summary = extract_card_summary(raw)
            unit = summary["price_usd_foil"] if e.foil else summary["price_usd"]
            total_value += (unit or 0) * e.quantity

    # Record (or refresh) today's value snapshot for the value-over-time chart.
    today = date.today()
    snap = (await db.execute(
        select(CollectionSnapshot).where(CollectionSnapshot.user_id == current_user.id, CollectionSnapshot.date == today)
    )).scalar_one_or_none()
    if snap:
        snap.total_value = round(total_value, 2)
        snap.total_cards = int(row.total_cards or 0)
    else:
        db.add(CollectionSnapshot(user_id=current_user.id, date=today,
                                  total_value=round(total_value, 2), total_cards=int(row.total_cards or 0)))

    return {
        "unique_cards": row.unique_cards or 0,
        "total_cards": row.total_cards or 0,
        "total_value": round(total_value, 2),
    }


@router.get("/value-history")
async def value_history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Daily collection-value snapshots (oldest→newest) for the chart."""
    rows = (await db.execute(
        select(CollectionSnapshot).where(CollectionSnapshot.user_id == current_user.id)
        .order_by(CollectionSnapshot.date).limit(180)
    )).scalars().all()
    return [{"date": s.date.isoformat(), "value": s.total_value, "cards": s.total_cards} for s in rows]


@router.get("/card-context/{scryfall_id}")
async def card_context(
    scryfall_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """For the card info modal: how many copies the user owns of this printing,
    and whether it's for sale in our marketplace."""
    owned = (await db.execute(
        select(func.coalesce(func.sum(CollectionEntry.quantity), 0))
        .where(CollectionEntry.user_id == current_user.id, CollectionEntry.scryfall_id == scryfall_id)
    )).scalar() or 0

    row = (await db.execute(
        select(func.count(Listing.id), func.min(Listing.price))
        .where(Listing.scryfall_id == scryfall_id, Listing.status == "active", Listing.price.is_not(None))
    )).first()
    count = row[0] or 0
    min_price = float(row[1]) if row and row[1] is not None else None

    return {"owned": int(owned), "market": {"count": count, "min_price": min_price}}


@router.get("")
async def list_collection(
    set_code: Optional[str] = None,
    condition: Optional[str] = None,
    foil: Optional[bool] = None,
    q: Optional[str] = None,
    rarity: Optional[str] = None,
    card_type: Optional[str] = None,
    sort_by: str = "added_at",
    order: str = "desc",
    page: int = 1,
    per_page: int = 20,
    with_cards: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CollectionEntry).where(CollectionEntry.user_id == current_user.id)

    if condition:
        query = query.where(CollectionEntry.condition == condition)
    if foil is not None:
        query = query.where(CollectionEntry.foil == foil)

    if order == "desc":
        query = query.order_by(desc(getattr(CollectionEntry, sort_by, CollectionEntry.added_at)))
    else:
        query = query.order_by(getattr(CollectionEntry, sort_by, CollectionEntry.added_at))

    def serialize(entry):
        return {
            "id": entry.id,
            "scryfall_id": entry.scryfall_id,
            "quantity": entry.quantity,
            "condition": entry.condition,
            "foil": entry.foil,
            "language": entry.language,
            "notes": entry.notes,
            "price_at_add": entry.price_at_add,
            "added_at": entry.added_at.isoformat(),
        }

    # Sorting by a card field (or filtering on one) needs the resolved card data,
    # so we fetch all of the user's cards in bulk (cached) and sort/filter in Python.
    _CARD_SORTS = {"name", "price", "rarity", "cmc"}
    card_sort = sort_by in _CARD_SORTS
    needs_card_data = bool(set_code or q or rarity or card_type or card_sort)
    if needs_card_data:
        all_entries = (await db.execute(query)).scalars().all()
        cards = await get_cards_bulk([e.scryfall_id for e in all_entries])
        set_target = set_code.lower() if set_code else None
        rarity_target = rarity.lower() if rarity else None
        name_target = q.strip().lower() if q else None
        type_target = card_type.strip().lower() if card_type else None

        def matches(e):
            c = cards.get(e.scryfall_id, {})
            if set_target and c.get("set", "").lower() != set_target:
                return False
            if rarity_target and c.get("rarity", "").lower() != rarity_target:
                return False
            if name_target and name_target not in c.get("name", "").lower():
                return False
            if type_target and type_target not in c.get("type_line", "").lower():
                return False
            return True

        filtered = [e for e in all_entries if matches(e)]

        if card_sort:
            _RARITY = {"common": 0, "uncommon": 1, "rare": 2, "mythic": 3, "special": 4, "bonus": 5}

            def sort_key(e):
                c = cards.get(e.scryfall_id, {})
                if sort_by == "name":
                    return c.get("name", "").lower()
                if sort_by == "price":
                    return c.get("price_usd", 0) or 0
                if sort_by == "rarity":
                    return _RARITY.get(c.get("rarity", ""), 0)
                if sort_by == "cmc":
                    return c.get("cmc", 0) or 0
                return 0
            filtered.sort(key=sort_key, reverse=(order == "desc"))

        total = len(filtered)
        start = (page - 1) * per_page
        page_entries = filtered[start:start + per_page]
        items = [serialize(e) for e in page_entries]
    else:
        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
        paged = query.offset((page - 1) * per_page).limit(per_page)
        items = [serialize(e) for e in (await db.execute(paged)).scalars().all()]

    if with_cards and items:
        cards = await get_cards_bulk([i["scryfall_id"] for i in items])
        for i in items:
            raw = cards.get(i["scryfall_id"])
            i["card"] = extract_card_summary(raw) if raw else None

    # Which binders each card sits in (the link already exists in binder_cards).
    entry_ids = [i["id"] for i in items]
    if entry_ids:
        rows = (await db.execute(
            select(BinderCard.collection_entry_id, Binder.id, Binder.name, Binder.color)
            .join(Binder, BinderCard.binder_id == Binder.id)
            .where(BinderCard.collection_entry_id.in_(entry_ids))
        )).all()
        bmap: dict = {}
        for ce_id, bid, bname, bcolor in rows:
            bmap.setdefault(ce_id, []).append({"id": bid, "name": bname, "color": bcolor})
        for i in items:
            i["binders"] = bmap.get(i["id"], [])

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if per_page else 1,
    }


@router.get("/sets")
async def collection_sets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Distinct sets present in the user's collection (for the set filter)."""
    entries = (await db.execute(
        select(CollectionEntry.scryfall_id).where(CollectionEntry.user_id == current_user.id)
    )).scalars().all()
    cards = await get_cards_bulk(list(entries))
    sets: dict[str, dict] = {}
    for raw in cards.values():
        code = raw.get("set")
        if not code:
            continue
        if code not in sets:
            sets[code] = {"code": code, "name": raw.get("set_name", code.upper()), "count": 0}
        sets[code]["count"] += 1
    return sorted(sets.values(), key=lambda s: s["name"])


@router.post("", status_code=201)
async def add_card(
    data: AddCardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch card from Scryfall to validate and get price
    try:
        card_data = await get_card_by_id(data.scryfall_id)
        card_summary = extract_card_summary(card_data)
        price = card_summary["price_usd_foil"] if data.foil else card_summary["price_usd"]
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found on Scryfall")

    # Check if entry already exists
    result = await db.execute(
        select(CollectionEntry).where(
            CollectionEntry.user_id == current_user.id,
            CollectionEntry.scryfall_id == data.scryfall_id,
            CollectionEntry.condition == data.condition,
            CollectionEntry.foil == data.foil,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.quantity += data.quantity
        entry = existing
    else:
        entry = CollectionEntry(
            user_id=current_user.id,
            scryfall_id=data.scryfall_id,
            quantity=data.quantity,
            condition=data.condition,
            foil=data.foil,
            language=data.language,
            notes=data.notes,
            price_at_add=price,
        )
        db.add(entry)

    await db.flush()
    return {"id": entry.id, "card": card_summary, "quantity": entry.quantity, "message": "Card added to collection"}


@router.patch("/{entry_id}")
async def update_entry(
    entry_id: int,
    data: UpdateCardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CollectionEntry).where(
            CollectionEntry.id == entry_id,
            CollectionEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    new_condition = data.condition if data.condition is not None else entry.condition
    new_foil = data.foil if data.foil is not None else entry.foil
    new_scryfall_id = data.scryfall_id if data.scryfall_id else entry.scryfall_id

    # The unique constraint is (user_id, scryfall_id, condition, foil). If the
    # edit changes printing/condition/foil to match another existing entry, merge
    # into it instead of letting the DB raise a unique-violation (500).
    if (new_scryfall_id, new_condition, new_foil) != (entry.scryfall_id, entry.condition, entry.foil):
        dup_result = await db.execute(
            select(CollectionEntry).where(
                CollectionEntry.user_id == current_user.id,
                CollectionEntry.scryfall_id == new_scryfall_id,
                CollectionEntry.condition == new_condition,
                CollectionEntry.foil == new_foil,
                CollectionEntry.id != entry.id,
            )
        )
        dup = dup_result.scalar_one_or_none()
        if dup:
            dup.quantity += data.quantity if data.quantity is not None else entry.quantity
            if data.notes is not None:
                dup.notes = data.notes
            await db.delete(entry)
            return {"message": "Merged", "merged_into": dup.id, "quantity": dup.quantity}

    if data.quantity is not None:
        entry.quantity = data.quantity
    entry.condition = new_condition
    entry.foil = new_foil
    entry.scryfall_id = new_scryfall_id
    if data.notes is not None:
        entry.notes = data.notes

    return {"message": "Updated"}


class BulkRequest(BaseModel):
    ids: List[int]
    action: str                      # delete | condition | foil
    condition: Optional[str] = None
    foil: Optional[bool] = None


@router.post("/bulk")
async def bulk_update(data: BulkRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Apply an action to many collection entries at once."""
    if not data.ids:
        return {"affected": 0}
    entries = (await db.execute(
        select(CollectionEntry).where(CollectionEntry.id.in_(data.ids), CollectionEntry.user_id == current_user.id)
    )).scalars().all()

    if data.action == "delete":
        for e in entries:
            await db.delete(e)
        return {"affected": len(entries), "action": "delete"}

    affected = 0
    deleted_ids: set[int] = set()
    for e in entries:
        new_cond = data.condition if (data.action == "condition" and data.condition) else e.condition
        new_foil = data.foil if (data.action == "foil" and data.foil is not None) else e.foil
        if (new_cond, new_foil) == (e.condition, e.foil):
            continue
        dup = (await db.execute(
            select(CollectionEntry).where(
                CollectionEntry.user_id == current_user.id,
                CollectionEntry.scryfall_id == e.scryfall_id,
                CollectionEntry.condition == new_cond,
                CollectionEntry.foil == new_foil,
                CollectionEntry.id != e.id,
            )
        )).scalar_one_or_none()
        if dup and dup.id not in deleted_ids:
            dup.quantity += e.quantity
            await db.delete(e)
            deleted_ids.add(e.id)
        else:
            e.condition = new_cond
            e.foil = new_foil
        affected += 1
    return {"affected": affected, "action": data.action}


@router.delete("/{entry_id}", status_code=204)
async def remove_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CollectionEntry).where(
            CollectionEntry.id == entry_id,
            CollectionEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)


@router.get("/export")
async def export_collection(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export the whole collection as a grimdeck-compatible CSV."""
    result = await db.execute(
        select(CollectionEntry)
        .where(CollectionEntry.user_id == current_user.id)
        .order_by(CollectionEntry.added_at)
    )
    entries = result.scalars().all()

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()

    for entry in entries:
        name = set_code = collector_number = ""
        try:
            summary = extract_card_summary(await get_card_by_id(entry.scryfall_id))
            name = summary.get("name", "")
            set_code = (summary.get("set", "") or "").upper()
            collector_number = summary.get("collector_number", "")
        except Exception:
            pass

        writer.writerow({
            "name": name,
            "set_code": set_code,
            "collector_number": collector_number,
            "scryfall_id": entry.scryfall_id,
            "quantity": entry.quantity,
            "condition": entry.condition,
            "finish": _foil_to_finish(entry.foil),
            "language": entry.language,
            "signed": "FALSE",
            "altered": "FALSE",
            "artist_proof": "FALSE",
            "misprint": "FALSE",
            "proxy": "FALSE",
            "notes": entry.notes or "",
            "acquired_date": "",
            "acquired_price": entry.price_at_add if entry.price_at_add is not None else "",
        })

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=magicvault_collection.csv"},
    )


@router.post("/import")
async def import_collection(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a grimdeck-style CSV into the collection (add/increment)."""
    raw = await file.read()
    if len(raw) > 5_000_000:  # 5 MB cap — guards against memory-exhaustion uploads
        raise HTTPException(status_code=413, detail="Arquivo muito grande (máx. 5 MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    # normalise header keys to lowercase for tolerant matching
    if reader.fieldnames:
        reader.fieldnames = [(f or "").strip().lower() for f in reader.fieldnames]

    imported = 0
    updated = 0
    skipped = 0
    errors: List[str] = []

    for i, row in enumerate(reader, start=2):  # row 1 is the header
        if i > 10_001:  # cap at 10k rows to bound work + external lookups
            errors.append("Importação limitada a 10.000 linhas; o restante foi ignorado.")
            break
        row = {(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        scryfall_id = row.get("scryfall_id") or ""
        name = row.get("name") or ""
        set_code = row.get("set_code") or ""

        try:
            if not scryfall_id and name:
                # fallback: resolve by name when scryfall_id is missing
                card = await get_card_by_name(name, fuzzy=True)
                scryfall_id = card["id"]
            if not scryfall_id:
                skipped += 1
                errors.append(f"linha {i}: sem scryfall_id nem nome resolvível")
                continue
        except Exception:
            skipped += 1
            errors.append(f"linha {i}: carta '{name}' não encontrada")
            continue

        try:
            quantity = int(float(row.get("quantity") or 1))
        except (ValueError, TypeError):
            quantity = 1
        condition = (row.get("condition") or "NM").upper()[:3]
        foil = _finish_to_foil(row.get("finish"))
        language = _norm_language(row.get("language"))
        notes = row.get("notes") or None
        price = None
        try:
            if row.get("acquired_price"):
                price = float(row["acquired_price"])
        except (ValueError, TypeError):
            price = None

        dup_result = await db.execute(
            select(CollectionEntry).where(
                CollectionEntry.user_id == current_user.id,
                CollectionEntry.scryfall_id == scryfall_id,
                CollectionEntry.condition == condition,
                CollectionEntry.foil == foil,
            )
        )
        existing = dup_result.scalar_one_or_none()
        if existing:
            existing.quantity += quantity
            updated += 1
        else:
            db.add(CollectionEntry(
                user_id=current_user.id,
                scryfall_id=scryfall_id,
                quantity=quantity,
                condition=condition,
                foil=foil,
                language=language,
                notes=notes,
                price_at_add=price,
            ))
            imported += 1

    await db.flush()
    return {
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:50],
    }
