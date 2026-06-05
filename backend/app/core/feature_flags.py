"""Runtime feature flags. state: off | admin (admins only) | on (everyone)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import FeatureFlag

# key -> human label (shown in the admin panel). Keys match the frontend.
KNOWN_FLAGS = {
    "cardRulings": "Rulings na carta",
    "setCompletion": "% de conclusão por set",
    "pnl": "Custo & Lucro/Prejuízo (P&L)",
    "events": "Eventos (calendário + lojas)",
    "aiDoctor": "IA: Deck Doctor (custo de IA)",
    "aiPrimer": "IA: Gerar primer (custo de IA)",
}


async def get_flag_states(db: AsyncSession) -> dict:
    """Current state for every known flag (defaults to 'off')."""
    rows = (await db.execute(select(FeatureFlag))).scalars().all()
    stored = {r.key: r.state for r in rows}
    return {k: stored.get(k, "off") for k in KNOWN_FLAGS}


async def flag_on_for(db: AsyncSession, key: str, user) -> bool:
    """Resolve a flag's effective state for a viewer: 'on' for everyone, 'admin'
    only for admins, 'off' for nobody."""
    state = (await get_flag_states(db)).get(key, "off")
    if state == "on":
        return True
    if state == "admin":
        return bool(getattr(user, "is_admin", False))
    return False
