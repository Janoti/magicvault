# VaultSpell — Roadmap das próximas features

Decisões já tomadas com o usuário estão marcadas. Nada aqui foi implementado
ainda — é o plano acordado.

## ✅ Já entregue nesta sessão
- Editar carta na coleção (+ merge de condição/foil)
- Sets: ver cartas, adicionar individual ou set inteiro
- Coleção → binder
- **Importar/Exportar CSV (formato grimdeck)** ← item antigo do README, já feito
- Valor da carta na coleção (preço Scryfall) + título "Coleção de {username}"
- Deploy single-service no Render (Dockerfile + render.yaml)

---

## 1. Comparar deck × coleção  🟢 pequeno
**Decisão:** casar por **nome da carta** (qualquer edição conta).

- **Backend:** `GET /api/decks/{id}/coverage`
  - Resolve cada `DeckCard.scryfall_id` → nome (Scryfall, cacheado).
  - Soma o que o usuário possui agrupado por nome (resolve nome de cada
    `CollectionEntry` também, cacheado).
  - Por carta: `needed / owned / missing` + `missing_cost` (preço × faltantes).
  - Resumo: % de completude, total faltante, custo pra completar.
- **Frontend:** aba "Comparar com coleção" na `DeckDetailPage` — barra de %,
  lista com badges tem/precisa, faltantes destacados, custo total.
- **Reuso:** `get_card_by_id`, `extract_card_summary` (já existem).

## 2. Notificações de preço (in-app)  🟡 médio
**Decisões:** entrega via **sino in-app**; gatilhos: **alvo da wishlist**,
**variação % na coleção**, **valor total da coleção**.

- **Models novos:**
  - `price_points(scryfall_id, price_usd, price_usd_foil, captured_at)` —
    snapshots diários das cartas rastreadas (união de coleção + wishlist).
  - `notifications(user_id, type, title, body, data_json, read, created_at)`.
- **Job (Render Cron Job, 1x/dia):** `POST /api/internal/price-refresh`
  (protegido por header secreto).
  - Coleta scryfall_ids distintos de todas as coleções + wishlists.
  - Busca preços no Scryfall, grava `price_points`.
  - Gera notificações por usuário:
    - wishlist: `preço_atual <= max_price` → alerta.
    - coleção: |Δ| ≥ limiar (ex. 10%) vs snapshot anterior → alerta.
    - total: resumo periódico (semanal) da variação do valor total.
- **Frontend:** sininho 🔔 no header (`Layout`) com contador de não-lidas e
  lista. Endpoints: `GET /api/notifications`, `POST /api/notifications/{id}/read`.

## 3. Amigos + compartilhamento  🔴 grande
**Decisão:** amizade com **pedido → aceitar**. Compartilhar coleção, binder e deck.

- **Models novos:**
  - `friendships(requester_id, addressee_id, status[pending|accepted], created_at)`
    com par único.
  - `shares(owner_id, friend_id, resource_type[collection|binder|deck],
    resource_id, created_at)`.
- **Endpoints:**
  - Amizade: `POST /api/friends/request {email_or_username}`,
    `POST /api/friends/{id}/accept`, `DELETE` (recusar/remover),
    `GET /api/friends`, `GET /api/friends/requests`.
  - Compartilhamento: `POST /api/shares {friend_id, resource_type, resource_id}`,
    `DELETE /api/shares/{id}`, `GET /api/shares/with-me`, `GET /api/shares/mine`.
  - Views somente-leitura: `GET /api/shared/binders/{id}`,
    `/api/shared/decks/{id}`, `/api/shared/collection/{user_id}` — validam que
    existe um share pro `current_user`.
- **Frontend:** página "Amigos" (adicionar por email/username, pedidos
  pendentes, aceitar/recusar); botão "Compartilhar" em deck/binder/coleção
  (escolhe amigos); aba "Compartilhados comigo".
- **Privacidade:** só amigos aceitos recebem share; views são read-only.
- **Reuso:** `Deck.is_public` / `Binder.is_public` já existem → opção futura de
  link público, se quiser.

---

## Ordem sugerida de implementação
1. **Deck × coleção** — rápido, alto valor, sem infra nova.
2. **Amigos + compartilhamento** — modelo novo, mas autocontido.
3. **Notificações de preço** — precisa do Cron + histórico; melhor por último.

## Fora de escopo (por enquanto, decisão do usuário)
- Scanner de código de barras via câmera
- App mobile (React Native)
