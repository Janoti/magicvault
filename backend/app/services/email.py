"""Email sending via Resend (https://resend.com). Falls back to logging the
message when RESEND_API_KEY is not configured, so the flow works in dev."""
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — email not sent. To=%s Subject=%s", to, subject)
        logger.warning("EMAIL BODY (dev fallback):\n%s", html)
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            )
            r.raise_for_status()
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


async def send_password_reset(to: str, reset_url: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#b8860b">⚔ MagicVault</h2>
      <p>Recebemos um pedido para redefinir sua senha.</p>
      <p>
        <a href="{reset_url}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 20px;
                  border-radius:8px;text-decoration:none">Redefinir senha</a>
      </p>
      <p style="color:#666;font-size:13px">Ou copie este link: {reset_url}</p>
      <p style="color:#666;font-size:13px">O link expira em {settings.reset_token_expire_minutes} minutos.
         Se você não pediu isso, ignore este email.</p>
    </div>
    """
    return await send_email(to, "Redefinir sua senha — MagicVault", html)
