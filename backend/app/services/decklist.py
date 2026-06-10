"""Parse pasted decklists from the main deckbuilding sites into a normalized list
of {qty, name, section} entries.

Handles the common export formats:
- Plain text / MTG Arena / MTGO: "4 Lightning Bolt", "4x Bolt", bare names,
  "Deck"/"Sideboard"/"Commander" headers, MTGO "SB:" line prefix.
- Moxfield: "1 Sol Ring (C21) 263 *F*".
- Archidekt: "1x Sol Ring (cmr) 263 [Commander{top}]".
- Deckstats: "//Commander" section comments and "1 Sol Ring #!Commander" tags.
- TappedOut: "1x Sol Ring *CMDR*", "^buy^" tags.
- CSV (Moxfield/Archidekt/Deckbox style) with quantity + name columns.

Card-name resolution is done by the caller (Scryfall); this module is pure text.
"""
import csv
import io
import re

# Header keyword -> section ("main" | "sideboard" | "commander" | None=ignore)
_SECTIONS = {
    "deck": "main", "mainboard": "main", "main": "main", "maindeck": "main",
    "commander": "commander", "commanders": "commander", "command zone": "commander",
    "sideboard": "sideboard", "sb": "sideboard", "companion": "sideboard",
    "maybeboard": None, "maybe": None, "tokens": None, "token": None,
    "considering": None, "planeswalkers": "main",
}

# "4 Bolt", "4x Bolt", "SB: 2 Bolt"
_QTY = re.compile(r"^\s*(?:SB:\s*)?(\d+)\s*[xX]?\s+(.+)$")
# A non-card preamble line some exporters add.
_PREAMBLE = re.compile(r"^(about|name)\b", re.I)


def _section_of(header: str):
    """If `header` names a section, return its normalized value (may be None to
    ignore that section); return False when it is not a header at all."""
    h = re.sub(r"\s*\(\d+\)\s*$", "", header).rstrip(":").strip().lower()
    return _SECTIONS[h] if h in _SECTIONS else False


def _clean_name(raw: str):
    """Strip set/collector/foil/category tags; return (name, is_commander)."""
    s = raw.strip()
    commander = bool(
        re.search(r"\*\s*cmdr\s*\*", s, re.I)
        or re.search(r"#!\s*commander", s, re.I)
        or re.search(r"\[[^\]]*commander[^\]]*\]", s, re.I)
    )
    s = re.sub(r"\s*\^[^^]*\^", "", s)      # TappedOut ^buy^
    s = re.sub(r"\s*#!\S+", "", s)          # Deckstats #!Commander
    s = re.sub(r"\s*\*[^*]*\*", "", s)      # *F*, *CMDR*, *Foil*
    s = re.sub(r"\s*[\(\[\{].*$", "", s)    # (SET) 123 / [Category] / {flags}
    return s.strip(), commander


def _parse_csv(text: str):
    """Return parsed cards if `text` looks like a CSV with name + quantity columns,
    else None."""
    head = text.lstrip().splitlines()[:1]
    if not head or "," not in head[0] or "name" not in head[0].lower():
        return None
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except Exception:
        return None
    if not rows:
        return None

    def col(d, *names):
        for k in d:
            if k and k.strip().lower() in names:
                return d[k]
        return None

    out = []
    for r in rows:
        name = col(r, "name", "card", "card name")
        if not name or not name.strip():
            continue
        qraw = col(r, "quantity", "count", "qty", "amount", "qtd") or "1"
        try:
            qty = int(re.sub(r"[^\d]", "", str(qraw)) or "1")
        except ValueError:
            qty = 1
        board = (col(r, "section", "board", "category") or "").strip().lower()
        if "commander" in board:
            section = "commander"
        elif "side" in board or "maybe" in board:
            section = "sideboard"
        else:
            section = "main"
        nm, cmd = _clean_name(name)
        if nm:
            out.append({"qty": max(1, min(qty, 99)), "name": nm,
                        "section": "commander" if cmd else section})
    return out or None


def parse_decklist(text: str, max_lines: int = 1000):
    """Parse a decklist into [{qty, name, section}], section in
    main|sideboard|commander. Tries CSV first, then the line-based formats."""
    csv_cards = _parse_csv(text)
    if csv_cards is not None:
        return csv_cards[:max_lines]

    cards = []
    section = "main"
    for raw in text.splitlines()[:max_lines]:
        line = raw.strip()
        if not line:
            # Commander blocks sit at the top and are separated from the deck by a
            # blank line (Moxfield/Arena), so a blank line ends the commander section.
            if section == "commander":
                section = "main"
            continue

        # Section headers, including Deckstats "//Commander" comment headers.
        header = line[2:].strip() if line.startswith("//") else line
        sec = _section_of(header)
        if sec is not False:
            section = sec if sec is not None else "ignore"
            continue
        if line.startswith(("//", "#")) or _PREAMBLE.match(line):
            continue
        if section == "ignore":
            continue

        line_section = "sideboard" if re.match(r"^\s*SB:\s*", line, re.I) else section

        m = _QTY.match(line)
        qty, rest = (int(m.group(1)), m.group(2)) if m else (1, line)
        name, commander = _clean_name(rest)
        if not name:
            continue
        cards.append({
            "qty": max(1, min(qty, 99)),
            "name": name,
            "section": "commander" if commander else line_section,
        })
    return cards
