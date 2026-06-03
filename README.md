# 📖 VaultSpell — MTG Collection Manager

A full-featured manager for your **Magic: The Gathering** collection — track cards,
build themed binders and decks, watch real-time prices, and import/export your
collection. Card data and prices come from the free [Scryfall API](https://scryfall.com/docs/api).

### 🔗 Live app: **[magicvault.onrender.com](https://magicvault.onrender.com/)**

> Free to use — sign up, build your collection, and share decks, binders, or your
> whole collection with friends or via a public link.
>
> *(Hosted on Render's free tier, so the first load may take a few seconds to wake up.)*

## 🧰 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS + react-query |
| Backend | FastAPI (Python 3.12) + SQLAlchemy (async) |
| Database | PostgreSQL |
| Cache | Redis / Valkey (optional — gracefully degrades) |
| Containers | Docker / Docker Compose |
| Card data | [Scryfall API](https://scryfall.com/docs/api) (free, no auth) |

## ✨ Features

### 🃏 Collection
- Add cards by search or name
- **Edit** any entry (quantity, condition, foil, notes) — duplicate
  condition/foil combinations are merged automatically
- Filter by condition (M/NM/LP/MP/HP/DMG) and foil
- **Real-time value** per card (Scryfall pricing) with page totals
- Set icon + **large card preview on hover**
- **Import / export** your whole collection as CSV (grimdeck-compatible)

### 📦 Sets
- Browse every MTG set
- Open a set to see all its cards
- Add cards individually, or **add the whole set** to your collection

### 📚 Binders
- Create themed binders (name, color, description)
- Move cards from your collection into a binder
- See the binder's total value

### ⚔ Decks
- Build decks for any format (Commander, Standard, Modern, …)
- Sideboard and commander support

### ⭐ Wishlist
- Track cards you want to buy and set a max price

## 🚀 Run locally

```bash
git clone https://github.com/Janoti/magicvault.git
cd magicvault
cp .env.example .env        # edit if you want
docker compose up --build
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API docs (Swagger):** http://localhost:8000/docs

### Run services separately

```bash
# backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

## ☁️ Deploy

VaultSpell ships as a **single web service**: FastAPI serves the built React SPA
and the API on one origin (no CORS). The root `Dockerfile` builds the frontend
into `/app/static`, and [`render.yaml`](./render.yaml) declares the web service,
PostgreSQL, and Redis on [Render](https://render.com). Every push to `main`
auto-deploys. Full guide in [`DEPLOY.md`](./DEPLOY.md).

## 🔌 API endpoints

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/cards/search?q=...
GET    /api/cards/autocomplete?q=...
GET    /api/cards/{id}

GET    /api/collection
POST   /api/collection
PATCH  /api/collection/{id}
DELETE /api/collection/{id}
GET    /api/collection/stats
GET    /api/collection/export        # download CSV
POST   /api/collection/import        # upload CSV

GET    /api/sets
GET    /api/sets/{code}/cards
POST   /api/sets/{code}/add-all

GET    /api/binders
POST   /api/binders
GET    /api/binders/{id}
PATCH  /api/binders/{id}
DELETE /api/binders/{id}
POST   /api/binders/{id}/cards
DELETE /api/binders/{id}/cards/{card_id}

GET    /api/decks
POST   /api/decks
GET    /api/decks/{id}
POST   /api/decks/{id}/cards
DELETE /api/decks/{id}

GET    /api/wishlist
POST   /api/wishlist
DELETE /api/wishlist/{id}
```

## 🗄 Database tables

- `users` — user accounts
- `collection_entries` — owned cards (scryfall_id + condition + foil)
- `binders` / `binder_cards` — themed binders and their cards
- `decks` / `deck_cards` — decks and their cards
- `wishlist_entries` — wishlist cards

Tables are created automatically on startup; no manual migration step needed.

## ⚙️ Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres DSN (sync `postgres://` is auto-normalized to asyncpg) | local Postgres |
| `REDIS_URL` | Redis/Valkey URL (cache only; app works without it) | `redis://localhost:6379` |
| `SECRET_KEY` | JWT secret — **set a strong value in production** | `changeme` |
| `ENVIRONMENT` | `development` / `production` | `development` |
| `CORS_ORIGINS` | Comma-separated allowed origins (local dev only) | localhost |
| `VITE_API_URL` | API URL for the dev frontend (empty = same-origin in prod) | `http://localhost:8000` |

## 🗺 Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the planned next features:
deck-vs-collection coverage, friends & sharing, and price-change notifications.

## 📄 License

MIT
