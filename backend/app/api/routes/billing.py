import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


def _ensure_configured():
    if not (settings.stripe_secret_key and settings.stripe_price_id):
        raise HTTPException(status_code=503, detail="Pagamentos ainda não configurados")


@router.get("/price")
async def get_price():
    """Public: the configured subscription price (for the Premium page)."""
    if not (settings.stripe_secret_key and settings.stripe_price_id):
        return {"configured": False}
    try:
        p = stripe.Price.retrieve(settings.stripe_price_id)
        return {
            "configured": True,
            "amount": (p.get("unit_amount") or 0) / 100,
            "currency": p.get("currency", "brl"),
            "interval": (p.get("recurring") or {}).get("interval", "month"),
        }
    except Exception as e:
        logger.error("Stripe price fetch failed: %s", e)
        return {"configured": False}


@router.get("/beta")
async def beta_status(db: AsyncSession = Depends(get_db)):
    """Public: how many free early-adopter premium slots remain."""
    limit = settings.beta_premium_limit
    taken = (await db.execute(select(func.count(User.id)))).scalar() or 0
    left = max(0, limit - taken)
    return {"limit": limit, "taken": taken, "left": left, "active": left > 0}


@router.post("/checkout")
async def create_checkout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _ensure_configured()
    base = settings.app_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
            client_reference_id=str(current_user.id),
            customer=current_user.stripe_customer_id or None,
            customer_email=None if current_user.stripe_customer_id else current_user.email,
            success_url=f"{base}/premium?success=1",
            cancel_url=f"{base}/premium?canceled=1",
            allow_promotion_codes=True,
        )
        return {"url": session.url}
    except Exception as e:
        logger.error("Stripe checkout failed: %s", e)
        raise HTTPException(status_code=502, detail="Erro ao iniciar o checkout")


@router.post("/portal")
async def billing_portal(current_user: User = Depends(get_current_user)):
    _ensure_configured()
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Sem assinatura ativa")
    base = settings.app_url.rstrip("/")
    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id, return_url=f"{base}/premium"
        )
        return {"url": session.url}
    except Exception as e:
        logger.error("Stripe portal failed: %s", e)
        raise HTTPException(status_code=502, detail="Erro ao abrir o portal")


async def _set_premium(db: AsyncSession, *, user_id=None, customer_id=None, value=True):
    user = None
    if user_id:
        user = (await db.execute(select(User).where(User.id == int(user_id)))).scalar_one_or_none()
    if not user and customer_id:
        user = (await db.execute(select(User).where(User.stripe_customer_id == customer_id))).scalar_one_or_none()
    if user:
        user.is_premium = value
        if customer_id and not user.stripe_customer_id:
            user.stripe_customer_id = customer_id
    return user


@router.post("/webhook")
async def webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        if settings.stripe_webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
        else:
            import json
            event = json.loads(payload)
    except Exception as e:
        logger.error("Stripe webhook verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid payload")

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        await _set_premium(db, user_id=obj.get("client_reference_id"), customer_id=obj.get("customer"), value=True)
    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        active = obj.get("status") in ("active", "trialing")
        await _set_premium(db, customer_id=obj.get("customer"), value=active)
    elif etype == "customer.subscription.deleted":
        await _set_premium(db, customer_id=obj.get("customer"), value=False)

    return {"received": True}
