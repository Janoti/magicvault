"""AI Deck Doctor — sends the deck (grounded in real Scryfall card data) to an LLM
and returns natural-language feedback. Supports Anthropic (Claude) or xAI (Grok);
if both keys are set, Claude is preferred. Keys live only in the environment."""
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_LANG = {"pt": "Portuguese (Brazil)", "en": "English", "es": "Spanish"}

_SYSTEM = (
    "You are an expert Magic: The Gathering deck advisor. Be concise, practical and "
    "honest. Only reference cards that exist; do not invent cards. Base your advice on "
    "the deck data provided. Reply in {language}. Keep it under 250 words."
)


def is_configured() -> bool:
    return bool(settings.anthropic_api_key or settings.xai_api_key)


def build_prompt(deck: dict, analysis: dict, cards: list) -> str:
    lines = [
        f"Deck: {deck.get('name')} ({deck.get('format')})",
        f"Spells: {analysis.get('nonlands')}, Lands: {analysis.get('lands')}, "
        f"Avg CMC: {analysis.get('avg_cmc')}",
        f"Roles: {analysis.get('categories')}",
        f"Colors (pips): {analysis.get('colors')}",
        "",
        "Decklist (qty x name — type — cmc):",
    ]
    for c in cards[:120]:
        lines.append(f"{c['qty']}x {c['name']} — {c['type']} — cmc {c['cmc']}")
    lines += [
        "",
        "Give: an overall rating out of 10, the main strengths, the main weaknesses, "
        "and 3-5 concrete suggestions (cards to add or cut, or ratio fixes).",
    ]
    return "\n".join(lines)


async def _call_anthropic(system: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.anthropic_model,
                "max_tokens": 700,
                "temperature": 0.4,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        data = r.json()
    return "".join(b.get("text", "") for b in data.get("content", [])).strip()


async def _call_xai(system: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.xai_api_key}"},
            json={
                "model": settings.xai_model,
                "temperature": 0.4,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        r.raise_for_status()
        data = r.json()
    return data["choices"][0]["message"]["content"].strip()


async def run_doctor(deck: dict, analysis: dict, cards: list, lang: str = "en") -> str:
    if not is_configured():
        raise RuntimeError("AI not configured")
    system = _SYSTEM.format(language=_LANG.get(lang, "English"))
    prompt = build_prompt(deck, analysis, cards)
    # Prefer Claude when its key is present.
    if settings.anthropic_api_key:
        return await _call_anthropic(system, prompt)
    return await _call_xai(system, prompt)
