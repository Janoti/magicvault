"""Public endpoint exposing the *effective* feature flags for the current viewer."""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_optional_user
from app.core.feature_flags import get_flag_states
from app.models.user import User

router = APIRouter()


@router.get("/flags")
async def public_flags(viewer: Optional[User] = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    states = await get_flag_states(db)
    is_admin = bool(viewer and viewer.is_admin)
    return {k: (s == "on" or (s == "admin" and is_admin)) for k, s in states.items()}
