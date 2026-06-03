from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_optional_user
from app.core.ratelimit import limiter
from app.models.user import User, Feedback

router = APIRouter()

VALID_TYPES = {"bug", "suggestion", "contact"}


class FeedbackRequest(BaseModel):
    type: str = "bug"
    message: str
    email: Optional[str] = None
    page: Optional[str] = None


@router.post("", status_code=201)
@limiter.limit("5/minute")
async def submit_feedback(
    request: Request,
    data: FeedbackRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    ftype = data.type if data.type in VALID_TYPES else "contact"

    fb = Feedback(
        user_id=user.id if user else None,
        type=ftype,
        message=data.message.strip()[:4000],
        email=(user.email if user else (data.email or None)),
        page=data.page,
    )
    db.add(fb)
    await db.flush()
    return {"id": fb.id, "message": "Recebido! Obrigado pelo feedback."}
