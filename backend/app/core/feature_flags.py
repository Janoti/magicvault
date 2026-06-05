"""Runtime feature flags. state: off | admin (admins only) | on (everyone)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import FeatureFlag

# key -> human label (shown in the admin panel). Keys match the frontend.
KNOWN_FLAGS = {
    "cardRulings": "Rulings na carta",
    "setCompletion": "% de conclusão por set",
    "pnl": "Custo & Lucro/Prejuízo (P&L)",
}


async def get_flag_states(db: AsyncSession) -> dict:
    """Current state for every known flag (defaults to 'off')."""
    rows = (await db.execute(select(FeatureFlag))).scalars().all()
    stored = {r.key: r.state for r in rows}
    return {k: stored.get(k, "off") for k in KNOWN_FLAGS}
