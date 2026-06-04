# TESTS.md — Plano de Testes & Validações do VaultSpell

Plano exaustivo de testes para o backend (FastAPI) e frontend (React). Cobre
unidade, integração, segurança/autorização, serviços externos, migrações e QA
manual. Marque `[x]` conforme for implementando.

---

## 0. Como rodar / setup

### Backend (pytest) — ✅ scaffolding pronto e validado (11 testes passando)
- Deps de teste em `backend/requirements-dev.txt`: `pytest`, `pytest-asyncio`, `httpx`, `asgi-lifespan`.
- **Banco de teste:** Postgres separado (NUNCA o de produção). O `conftest.py`
  **força** `DATABASE_URL = TEST_DATABASE_URL` (default `...@localhost:5432/magicvault_test`).
  Criar o DB uma vez: `docker exec magicvault_db psql -U magicvault -c 'CREATE DATABASE magicvault_test;'`.
- **Rodar (no container, host do DB = `postgres`):**
  ```
  docker exec -w /app \
    -e TEST_DATABASE_URL='postgresql+asyncpg://magicvault:magicvault123@postgres:5432/magicvault_test' \
    -e ENVIRONMENT=test magicvault_api python -m pytest tests/
  ```
- **Fixtures** (`tests/conftest.py`): `client` (app via LifespanManager → roda
  create_all + migrações; dispõe o engine por teste p/ evitar erro de event loop)
  e `auth` (registra usuário único + token).
- **Rate limit OFF em teste** (`ENVIRONMENT=test` desliga o slowapi) — evita 429 nos testes.
- **Já implementado:** `tests/test_smoke.py` (health, billing price/beta) e
  `tests/test_auth.py` (register/login/validações/me/forgot). Os demais §1–§5 são o roadmap.

### Frontend
- `tsc --noEmit` (typecheck) — já é o gate atual; manter verde.
- **Paridade de i18n** (script): pt/en/es devem ter exatamente as mesmas chaves
  (ver §5.2). Hoje validamos só JSON válido.
- Unit/component: adicionar **Vitest + @testing-library/react** (ainda não setado).

---

## 1. Backend — Unidade & Integração (por router)

### 1.1 auth (`/api/auth`)
- [ ] register: cria usuário + retorna token + `to_user_out`.
- [ ] register: **senha < 6** → 400.
- [ ] register: **username inválido** (regex `^[a-zA-Z0-9_.-]{3,30}$`): vazio, com espaço, com `@`, > 30 → 400.
- [ ] register: email duplicado (case-insensitive) → 400; username duplicado (case-insensitive) → 400.
- [ ] register: **beta** — os primeiros N (`beta_premium_limit`) recebem `is_premium=is_beta=True`; o N+1 não.
- [ ] login: por email E por username (case-insensitive); senha errada → 401; usuário inexistente → 401.
- [ ] login: **rate limit** 10/min → 429 no 11º.
- [ ] login: usuário `is_active=False` → 403 (via `get_current_user`).
- [ ] me: retorna o usuário autenticado; sem token → 401; token malformado → 401 (não 500).
- [ ] update_me: troca email/username (com checagem de duplicado); **sanitiza links** (rejeita `javascript:`, prepend `https://`); cap de avatar (~256KB) e bio (1000); seta `contact`, `contact_public`, `collection_public`.
- [ ] forgot-password: **sempre 200** (não revela existência); cria token; rate limit 3/min.
- [ ] reset-password: token válido → troca senha; token expirado/usado/inexistente → 400; **nova senha < 6** → 400; rate limit 10/min; token vira `used=True` (single-use).

### 1.2 cards (`/api/cards`)
- [ ] search: q válido → cards + total_cards; q curto (<2) → 422; erro Scryfall → 502.
- [ ] search por efeito: `oracle:"..."` retorna mais que `keyword:`.
- [ ] autocomplete, get_card (id válido/inválido→404), named (fuzzy).
- [ ] fx/usd-brl: retorna `{usd_brl}` (com fallback se a API de câmbio cair).
- [ ] extract_card_summary: inclui `art_crop`, `purchase_uri`, `price_usd/eur`.

### 1.3 collection (`/api/collection`)
- [ ] stats: unique/total/**total_value** (soma price × qty, foil usa foil price).
- [ ] list: paginação; filtros **set_code, condition, foil, q (nome), rarity, card_type**; combinação de filtros.
- [ ] list: **sort_by** name/price/rarity/cmc (resolve cartas) + added_at/quantity (DB); `order` asc/desc.
- [ ] list: `with_cards=true` anexa `card` (1 chamada batcheada — sem N+1).
- [ ] list: cada item traz `binders[]` (vínculo binder_cards).
- [ ] add: cria entrada; **merge** ao re-adicionar mesma (scryfall_id, condition, foil) — soma qty, não viola unique.
- [ ] update: editar qty/condition/foil/notes; **mudar condition/foil colidindo** com outra entrada → merge (não 500).
- [ ] export: CSV no formato grimdeck (round-trip).
- [ ] import: parse por header (DictReader); **cap 5MB** → 413; **cap 10k linhas**; finish→foil, language map; fallback por nome.
- [ ] public/{username}: 404 se `collection_public=False`; ok se público (read-only).
- [ ] delete: remove; só do dono.

### 1.4 binders (`/api/binders`)
- [ ] CRUD; get ordena cards por **page, slot, position**; addCard (valida que a collection_entry é do dono); removeCard.
- [ ] **setLocation**: page (0–999), slot (0–9) clamp; só do dono.

### 1.5 decks (`/api/decks`)
- [ ] CRUD; list traz `cover` (art da 1ª carta / comandante).
- [ ] **import**: parser de decklist — `4 Card`, `4x Card`, `1 Card (SET) 123 *F*`, nome puro = 1; seções Sideboard/Commander; cap 400 linhas; relatório added/skipped/errors.
- [ ] get: retorna `primer`, `role` por carta, `is_public`.
- [ ] update/patch: name/format/description/**primer** (cap 8000)/**is_public**.
- [ ] analysis: curva, cores (pips), tipos, categorias; só dono OU público (`_viewable_deck`).
- [ ] coverage: tem/falta/custo (match por nome).
- [ ] compare-options: meus + amigos públicos + públicos (exclui o atual).
- [ ] public/{id}: 404 se não público; ok read-only.
- [ ] **doctor**: gated premium (403 p/ não-premium); 503 se IA não configurada; **cache** por (deck, lang, hash do conteúdo); `refresh=true` força; erro do provedor é surfaceado.
- [ ] **suggestions (EDHREC)**: `commander:null` se sem comandante; senão lista com flag `owned`; exclui cartas já no deck.
- [ ] addCard.

### 1.6 wishlist (`/api/wishlist`)
- [ ] list: traz `card`, **market** (count + min_price dos listings ativos), **delta/delta_pct** (vs snapshot), **target_hit** (current ≤ max_price).
- [ ] add: grava **price_snapshot**; duplicado → 400.
- [ ] update: seta/limpa **max_price** (target); notes.
- [ ] remove.

### 1.7 friends (`/api/friends`)
- [ ] request por username/email; **self** → 400; dedup; se o outro já convidou → aceita.
- [ ] accept (só addressee); remove (decline/cancel/unfriend).
- [ ] list/requests: **NÃO** expõe email (só username/display_name/avatar).

### 1.8 shares (`/api/shares`)
- [ ] with-friend (precisa ser amigo + dono do recurso); public (gera token + slug); slug update (único por dono); by-slug; mine; with-me; delete; view público sem auth.
- [ ] `assert_owns_resource`: binder/deck de outro → 404.

### 1.9 users (`/api/users/{username}`)
- [ ] public_profile: stats; **public_decks** (só is_public); **collection_public**; **contact** só se `contact_public`.

### 1.10 admin (`/api/admin`)
- [ ] todos exigem `get_current_admin` (não-admin → 403).
- [ ] stats; list_users; update_user (is_active/admin/premium/**email**); **não pode** remover próprio admin/active.
- [ ] **delete_user**: apaga em cascata (messages, interests, listings, binder_cards, deck_cards, collection, binders, decks, wishlist, friendships, shares, tokens, feedback) sem violar FK; não pode deletar a si mesmo.
- [ ] feedback list/resolve.

### 1.11 feedback (`/api/feedback`)
- [ ] submit: anônimo ou logado; tipo validado (bug/suggestion/contact); message vazia → 400; cap 4000; rate limit 5/min.

### 1.12 listings / trades (`/api/listings`)
- [ ] browse (auth), mine (com interest count); create **gated premium**; validações: preço ≥0/≤1M, foto cap ~512KB, wanted/notes cap, wanted_cards cap 30.
- [ ] delete/set_status/resolve (sold/traded→removido; **cancelled→continua ativo**) — só dono.
- [ ] interest: **dedup** (1 por buyer/listing); não pode na própria; **email** ao vendedor; rate limit 20/h.
- [ ] interests (só dono); conversations (buyer+seller); thread (só participantes); **send_message** (só participante, cap 2000, rate limit 30/min, **email** ao outro); resolve_thread (só vendedor).
- [ ] stats: sold/traded/active.

### 1.13 billing (`/api/billing`)
- [ ] price/beta (públicos).
- [ ] checkout/portal: gated premium/assinatura.
- [ ] **webhook**: assinatura inválida → 400; **sem secret em produção → 400** (não escala premium); evento válido → `_set_premium`.

---

## 2. Segurança & Autorização (prioridade alta)

- [ ] **IDOR matrix**: para cada recurso (collection entry, binder, deck, listing, interest, share, wishlist), usuário B **não** acessa/edita/deleta o de A → 404/403.
- [ ] **Rate limits**: login(10/min), register(5/min), forgot(3/min), reset(10/min), feedback(5/min), interest(20/h), message(30/min) → 429.
- [ ] **XSS**: links de perfil com `javascript:`/`data:` são neutralizados (back + front `safeUrl`); conteúdo user em emails é `escape`-ado.
- [ ] **Webhook Stripe**: rejeita não-assinado em produção (sem escalonamento de premium).
- [ ] **Caps de input**: avatar, foto de listing, bio, CSV (tamanho/linhas), primer.
- [ ] **Path traversal**: `/../../etc/passwd` no SPA fallback fica confinado a `static/`.
- [ ] **is_active**: conta desativada não autentica (403).
- [ ] **JWT**: alg fixo (HS256); token adulterado/expirado → 401; `sub` não numérico → 401 (não 500).
- [ ] **Headers**: X-Frame-Options/nosniff/Referrer-Policy presentes; HSTS em produção.
- [ ] **PII**: email nunca exposto a outros usuários (friends/shares/profile).
- [ ] **CORS**: origens restritas (não wildcard) com credenciais.

---

## 3. Serviços

- [ ] **scryfall.get_cards_bulk**: dedup, chunk 75, cache hit/miss; resiliente a falha (retorna parcial).
- [ ] **edhrec.edhrec_slug**: "Atraxa, Praetors' Voice" → "atraxa-praetors-voice"; `commander_recommendations` parseia `cardlists`, dedup, cache 1d, falha graciosa.
- [ ] **fx.get_usd_brl**: cache 12h; fallback 5.0 se API cair.
- [ ] **deck_doctor**: `is_configured` (anthropic OU xai); prefere Anthropic; `_raise_http` surfacia o erro real; build_prompt inclui análise + cards.
- [ ] **sharing.build_resource_view**: collection/binder/deck (com primer); `assert_owns_resource`.
- [ ] **email.send_email**: sem RESEND_API_KEY → loga (não quebra); com → POST Resend.

---

## 4. Migrações & Dados

- [ ] **_COLUMN_MIGRATIONS idempotente**: rodar 2× (startup) não falha (`IF NOT EXISTS`).
- [ ] create_all cria tabelas novas (messages) sem afetar existentes.
- [ ] **Unique constraints**: collection (user, scryfall, condition, foil); wishlist (user, scryfall); friendship (requester, addressee).
- [ ] **Cascade delete** (admin delete_user): nenhuma linha órfã; nenhum erro de FK.
- [ ] ADMIN_EMAIL bootstrap vira admin no startup.

---

## 5. Frontend

### 5.1 Estático
- [ ] `tsc --noEmit` verde (gate de cada commit).
- [ ] Sem `console.error`/warnings de chave i18n faltando ao navegar.

### 5.2 Paridade de i18n (script automatizável)
- [ ] pt/en/es têm **o mesmo conjunto de chaves** (recursivo). Hoje só validamos JSON. Adicionar script que faz diff das chaves e falha no CI.

### 5.3 Component/Unit (Vitest + Testing Library)
- [ ] CardPrice: USD + BRL (com fx), link pra loja, modo compact.
- [ ] RoleTag / cardRole: Sol Ring→ramp, Swords→removal, Wrath→wipe, Counterspell→interaction, Divination→draw, terreno→null.
- [ ] DeckCompare: veredito (curva mais baixa, mais remoção…); empty state.
- [ ] PlaytestModal: 7 cartas, mulligan, comprar, biblioteca decrementa.
- [ ] PileView: agrupa por CMC, lands na coluna 'L'.
- [ ] Wishlist: busca dinâmica, target alert, market gated premium.

### 5.4 E2E (Playwright — opcional)
- [ ] Fluxo: registrar → adicionar carta → criar deck → importar decklist → análise → exportar.
- [ ] Trades: criar oferta (premium) → outro user "tenho interesse" → chat → resolver.
- [ ] Público: deck/coleção público → abrir `/d/:id` e `/c/:username` sem login.

---

## 6. QA manual — smoke por página (checklist rápido)

- [ ] Landing/Login: arte rotaciona; CTAs; idioma; beta banner.
- [ ] /features: 6 categorias renderizam.
- [ ] Coleção: filtros, sort (persiste no refresh), grade/lista, valor total, tags de função, chips de binder, add→binder/deck, import/export.
- [ ] Busca: nome + efeito + chips de habilidade.
- [ ] Deck: toolbar (análise, coverage, comparar, sugestões, doctor, primer), playtest, pilhas, export, público + aviso.
- [ ] Binder: page/slot, add-from-collection (nome+imagem).
- [ ] Wishlist: busca dinâmica, alertas de preço/alvo, mercado, ações.
- [ ] Trades: criar, interesse, chat (+email), resolver, stats.
- [ ] Perfil público: decks/coleção públicos, contato.
- [ ] Admin: editar email, deletar conta.

---

## 7. CI (sugestão)

`.github/workflows/ci.yml`:
1. **frontend**: `npm ci && npm run build` (tsc + vite) + i18n parity script.
2. **backend**: subir Postgres (service), `pip install -r requirements.txt -r requirements-dev.txt`, `pytest -q`.
3. (Opcional) Playwright E2E em PRs.

---

## 8. Prioridade sugerida de implementação
1. **Segurança/autorização** (§2) — protege o que mais importa em produção.
2. **Auth + collection + decks** (§1.1, 1.3, 1.5) — núcleo do app.
3. **Trades + billing webhook** (§1.12, 1.13) — onde há dinheiro.
4. **Paridade i18n** (§5.2) — barato e pega bug visual fácil.
5. Resto + E2E.
