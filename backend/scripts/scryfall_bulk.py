#!/usr/bin/env python3
"""Ingest the Scryfall bulk data into the local `scryfall_cards` table.

Downloads a bulk file (default: all_cards — every printing in every language),
streams it with ijson (so memory stays low) and upserts in batches with psycopg2.
Run periodically (cron). Decoupled from the async app on purpose.

Usage:
    python scripts/scryfall_bulk.py [--type all_cards|default_cards] [--limit N]

Env: DATABASE_URL (the app's URL works; the "+asyncpg" driver suffix is stripped).
"""
import os
import sys
import time
import tempfile

import httpx
import ijson
import psycopg2
from psycopg2.extras import execute_values, Json

BULK_LIST = "https://api.scryfall.com/bulk-data"
BATCH = 1000
HEADERS = {"User-Agent": "VaultSpell/1.0", "Accept": "application/json"}


def _sync_dsn() -> str:
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        sys.exit("DATABASE_URL not set")
    return dsn.replace("+asyncpg", "").replace("+psycopg2", "")


def _bulk_uri(bulk_type: str) -> str:
    r = httpx.get(BULK_LIST, headers=HEADERS, timeout=30)
    r.raise_for_status()
    for b in r.json().get("data", []):
        if b.get("type") == bulk_type:
            print(f"bulk '{bulk_type}': {b.get('size', 0) / 1e6:.0f} MB, updated {b.get('updated_at')}")
            return b["download_uri"]
    sys.exit(f"bulk type '{bulk_type}' not found")


def _download(uri: str) -> str:
    fd, path = tempfile.mkstemp(prefix="scryfall_", suffix=".json")
    os.close(fd)
    t0 = time.time()
    with httpx.stream("GET", uri, headers=HEADERS, timeout=None, follow_redirects=True) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=1 << 20):
                f.write(chunk)
    print(f"downloaded to {path} in {time.time() - t0:.0f}s ({os.path.getsize(path) / 1e6:.0f} MB)")
    return path


UPSERT = """
INSERT INTO scryfall_cards (id, oracle_id, name, lang, set_code, collector_number, data, updated_at)
VALUES %s
ON CONFLICT (id) DO UPDATE SET
  oracle_id = EXCLUDED.oracle_id, name = EXCLUDED.name, lang = EXCLUDED.lang,
  set_code = EXCLUDED.set_code, collector_number = EXCLUDED.collector_number,
  data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
"""
TEMPLATE = "(%s,%s,%s,%s,%s,%s,%s,now())"


def _row(c: dict):
    return (
        c["id"], c.get("oracle_id"), c.get("name", ""), c.get("lang", "en"),
        c.get("set"), c.get("collector_number"), Json(c),
    )


def ingest(bulk_type: str, limit: int | None):
    uri = _bulk_uri(bulk_type)
    path = _download(uri)
    conn = psycopg2.connect(_sync_dsn())
    conn.autocommit = False
    cur = conn.cursor()
    total = 0
    batch = []
    t0 = time.time()
    try:
        with open(path, "rb") as f:
            for card in ijson.items(f, "item", use_float=True):
                if not card.get("id"):
                    continue
                batch.append(_row(card))
                if len(batch) >= BATCH:
                    execute_values(cur, UPSERT, batch, template=TEMPLATE, page_size=BATCH)
                    conn.commit()
                    total += len(batch)
                    batch = []
                    if total % 50000 == 0:
                        print(f"  {total} cards... ({total / (time.time() - t0):.0f}/s)")
                    if limit and total >= limit:
                        break
            if batch and not (limit and total >= limit):
                execute_values(cur, UPSERT, batch, template=TEMPLATE, page_size=BATCH)
                conn.commit()
                total += len(batch)
        # Trigram index so name search (ILIKE '%q%') is fast. Built here, off the
        # app's startup path. Idempotent.
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS ix_scryfall_cards_name_trgm "
                "ON scryfall_cards USING gin (lower(name) gin_trgm_ops)"
            )
            conn.commit()
            print("search index ok")
        except Exception as e:
            print("index step skipped:", e)
    finally:
        cur.close()
        conn.close()
        try:
            os.remove(path)
        except OSError:
            pass
    print(f"DONE: {total} cards in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    args = sys.argv[1:]
    bulk_type = "all_cards"
    limit = None
    if "--type" in args:
        bulk_type = args[args.index("--type") + 1]
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    ingest(bulk_type, limit)
