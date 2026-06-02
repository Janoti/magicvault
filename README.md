# ⚔ MagicVault — MTG Collection Manager

Gerenciador completo de cartas Magic: The Gathering

## 🧰 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | FastAPI (Python 3.12) + SQLAlchemy async |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 |
| Proxy | Nginx |
| Containers | Docker Compose |
| API Cards | [Scryfall API](https://scryfall.com/docs/api) (grátis, sem auth) |

## 🚀 Como rodar

### 1. Clone e configure o `.env`

```bash
git clone <repo>
cd magicvault
cp .env.example .env
# edite .env com suas configurações
```

### 2. Suba os containers

```bash
docker compose up --build
```

### 3. Acesse

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Docs API (Swagger):** http://localhost:8000/docs

## 📦 Funcionalidades

### 🃏 Coleção
- Adicionar cartas por busca ou nome
- Filtrar por condição (M/NM/LP/MP/HP/DMG), foil, idioma
- Controle de quantidade
- Preços em tempo real via Scryfall
- Paginação

### 📚 Binders Temáticos
- Crie binders com nome, cor e descrição personalizados
- Adicione cartas da sua coleção ao binder
- Veja o valor total do binder
- Organize por tema (Commander, Rares, Coleção por set, etc.)

### ⚔ Decks
- Crie decks para diferentes formatos (Commander, Standard, Modern, etc.)
- Adicione cartas ao deck com quantidade
- Suporte a sideboard e commander

### ⭐ Wishlist
- Adicione cartas que você quer comprar
- Defina preço máximo
- Acompanhe o valor total da wishlist

### 📦 Sets
- Navegue por todos os sets do MTG
- Filtro por tipo de set
- Links diretos para o Scryfall

## 🔌 API Endpoints

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

GET    /api/sets
```

## 🗄 Banco de dados

Tabelas:
- `users` — contas de usuário
- `collection_entries` — cartas na coleção (scryfall_id + condição + foil)
- `binders` — binders temáticos
- `binder_cards` — relação binder ↔ collection_entry
- `decks` — decks construídos
- `deck_cards` — cartas num deck
- `wishlist_entries` — cartas na wishlist

## 🔧 Desenvolvimento

### Backend separado
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend separado
```bash
cd frontend
npm install
npm run dev
```

### Variáveis de ambiente importantes

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `POSTGRES_PASSWORD` | Senha do banco | magicvault123 |
| `SECRET_KEY` | JWT secret (mude em produção!) | changeme |
| `ENVIRONMENT` | development / production | development |
| `VITE_API_URL` | URL da API para o frontend | http://localhost:8000 |

## 📝 Próximos passos (ideias)

- [ ] Scanner de código de barras via câmera
- [ ] Importar/exportar coleção CSV
- [ ] Comparar deck com cartas da coleção
- [ ] Notificações de variação de preço
- [ ] Modo público para compartilhar binders/decks
- [ ] App mobile (React Native)
