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


def _raise_http(provider: str, r: httpx.Response):
    """Surface the provider's real error (e.g. model not found, no credits)."""
    body = r.text[:300]
    logger.error("%s API %s: %s", provider, r.status_code, body)
    raise RuntimeError(f"{provider} {r.status_code}: {body}")


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
        if r.status_code >= 400:
            _raise_http("Anthropic", r)
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
        if r.status_code >= 400:
            _raise_http("xAI", r)
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


_PRIMER_SYSTEM = (
    "You are an expert Magic: The Gathering player writing a deck primer for the deck's "
    "owner to publish. Be concise, practical and honest. Only reference cards that exist "
    "in the provided decklist; do not invent cards. Reply in {language}. Use exactly these "
    "four section headings, each followed by short bullet lines starting with '- ': "
    "{h1}, {h2}, {h3}, {h4}. No preamble, no closing remarks."
)

_PRIMER_HEADINGS = {
    "pt": ("Win conditions:", "Mulligan:", "Combos:", "Matchups:"),
    "en": ("Win conditions:", "Mulligan:", "Combos:", "Matchups:"),
    "es": ("Condiciones de victoria:", "Mulligan:", "Combos:", "Enfrentamientos:"),
}


async def run_primer(deck: dict, analysis: dict, cards: list, lang: str = "en") -> str:
    """Generate a deck primer (win cons / mulligan / combos / matchups) as text."""
    if not is_configured():
        raise RuntimeError("AI not configured")
    h = _PRIMER_HEADINGS.get(lang, _PRIMER_HEADINGS["en"])
    system = _PRIMER_SYSTEM.format(language=_LANG.get(lang, "English"), h1=h[0], h2=h[1], h3=h[2], h4=h[3])
    prompt = build_prompt(deck, analysis, cards).split("\n\nGive:")[0]
    if settings.anthropic_api_key:
        return await _call_anthropic(system, prompt)
    return await _call_xai(system, prompt)
