"""Email sending via Resend (https://resend.com). Falls back to logging the
message when RESEND_API_KEY is not configured, so the flow works in dev."""
import logging
from html import escape

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
      <h2 style="color:#b8860b">📖 VaultSpell</h2>
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
    return await send_email(to, "Redefinir sua senha — VaultSpell", html)


def render_campaign_html(
    *,
    title: str,
    body: str,
    image_url: str | None = None,
    cta_text: str | None = None,
    cta_url: str | None = None,
    unsubscribe_url: str | None = None,
) -> str:
    """Render a branded campaign email. `body` keeps line breaks; everything is
    escaped so admin-entered text can't inject markup."""
    paragraphs = "".join(
        f"<p style='margin:0 0 14px;line-height:1.6'>{escape(line)}</p>"
        for line in body.split("\n") if line.strip()
    ) or "<p></p>"

    hero = (
        f"<img src='{escape(image_url)}' alt='' "
        f"style='width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-bottom:20px'>"
        if image_url else ""
    )
    heading = (
        f"<h1 style='font-size:22px;color:#1a1f35;margin:0 0 16px'>{escape(title)}</h1>"
        if title else ""
    )
    cta = (
        f"<p style='margin:24px 0'>"
        f"<a href='{escape(cta_url)}' "
        f"style='display:inline-block;background:#6c5ce7;color:#fff;padding:13px 24px;"
        f"border-radius:10px;text-decoration:none;font-weight:600'>{escape(cta_text)}</a></p>"
        if cta_text and cta_url else ""
    )
    footer_unsub = (
        f"<a href='{escape(unsubscribe_url)}' style='color:#8892b0'>Cancelar inscrição</a> · "
        if unsubscribe_url else ""
    )

    return f"""
    <div style="background:#f4f5fb;padding:24px 0;font-family:system-ui,-apple-system,sans-serif">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(26,31,53,.08)">
        <div style="background:linear-gradient(135deg,#6c5ce7,#a55eea);padding:18px 28px">
          <span style="color:#fff;font-size:18px;font-weight:700">📖 VaultSpell</span>
        </div>
        <div style="padding:28px;color:#1a1f35;font-size:15px">
          {hero}
          {heading}
          {paragraphs}
          {cta}
        </div>
        <div style="padding:16px 28px;border-top:1px solid #eceef7;color:#8892b0;font-size:12px">
          {footer_unsub}VaultSpell — seu cofre de cartas Magic.
        </div>
      </div>
    </div>
    """
