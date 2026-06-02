# MagicVault — Estratégia de Produto

> Foco: **Magic: The Gathering apenas** (sem Pokémon / outros TCGs por enquanto).
> Modelo: **freemium** — núcleo grátis para crescer, recursos avançados pagos.

## 1. Posicionamento (o "porquê")

O mercado está dividido:
- **Trackers de coleção** (ManaBox, Dragon Shield) sabem o que você tem.
- **Deck builders** (Moxfield, Archidekt) montam decks lindos.
- Quase ninguém faz os dois **conversando bem**.

**A aposta do MagicVault: "o app conhece a SUA coleção" e age como um assistente
pessoal de MTG** — não só um banco de cartas. Tudo (deck builder, sugestões,
análise) leva em conta o que você realmente possui. Esse é o diferencial e o fio
condutor de todas as decisões abaixo.

## 2. Grátis vs Premium

**Grátis** (aquisição + viralidade):
- Coleção, binders, decks, wishlist
- Preços em tempo real (Scryfall)
- Importar/exportar CSV
- **Compartilhamento** (link público + amigos) ← motor de viralidade
- Comparar deck × coleção (versão básica: tem/falta/custo)

**Premium** (pago — paywall no que dá trabalho/valor de poder):
- **Histórico e analytics de valor** da coleção + **notificações de preço**
- **AI Deck Doctor** (análise de deck, nota, sugestões) — custo de LLM → pago
- **Deck builder ciente da coleção** com sugestões de substituição usando só o que você tem
- **Categorias inteligentes** (ramp/draw/removal/tutor/boardwipe) automáticas
- **Deck DNA** (impressão digital de arquétipo)
- Binders/decks ilimitados (grátis tem teto)
- Hospedagem **sempre-ligada** (sem cold start)

**Lógica do paywall:** cobrar o que tem custo computacional (IA) ou é "power-user
analytics"; manter núcleo + compartilhamento grátis para crescer.

## 3. Priorização das funcionalidades (effort × valor)

### Fase 1 — Núcleo + viralidade (grátis)
1. **Amigos + compartilhamento** — _backend pronto_; falta UI. (viralidade)
2. **Deck × coleção** (collection-aware) — o coração do diferencial. 🟢 rápido
3. **Categorias inteligentes** (estilo Archidekt) — auto-classificar cartas do deck. 🟡
4. **Página pública do deck + QR + export** (estilo Moxfield). 🟡

### Fase 2 — Analytics premium
5. **Valor da coleção** (total, por deck, histórico) + **notificações de preço**. 🟡
6. **Sugestões estilo EDHREC** (cartas que combinam) via dados públicos. 🟡
7. **AI Deck Doctor** — LLM analisa o deck e dá nota/recomendações. 🔴 premium
8. **Deck DNA** — % midrange/control/combo, "parecido com decks vencedores". 🔴 premium

### Fase 3 — Diferenciais "moonshot"
9. **Builder com substituições** (monta deck só com sua coleção). 🔴
10. **Evolução automática do deck** (novos sets/bans → upgrades sugeridos). 🔴
11. **Treino com IA pós-partida** (estilo Chess.com). 🔴🔴 enorme
12. **Scanner de cartas por câmera** (paridade ManaBox). 🔴 mobile-centric

### Explicitamente fora de escopo (agora)
- Pokémon / meta do Limitless e qualquer TCG não-MTG
- App mobile nativo (React Native)
- Scanner por código de barras

## 4. Como cobrar (mecânica)

- **Stripe** assinatura (mensal/anual) + talvez "lifetime" early-bird.
- Backend: campo `plan`/`is_premium` no `User` + webhook do Stripe que liga a flag;
  dependência `require_premium` nas rotas pagas.
- Frontend: telas de upgrade + gates nos recursos premium.
- **Limites do grátis** pra incentivar upgrade (ex.: 3 decks / 2 binders) — ajustar depois.

## 5. Minha recomendação de sequência

Construir o **loop viral grátis primeiro** (amigos/compartilhamento + páginas
públicas + deck×coleção), porque tração importa mais que monetização no início.
Depois ligar o **premium** com as analytics de valor/preço (baixo custo, alto valor
percebido) e só então o **AI Deck Doctor / Deck DNA** (caros, mas são o "uau" que
justifica pagar e ninguém junta tudo num lugar só).

A combinação **"conhece sua coleção" + IA assistente** é o que Moxfield, Archidekt
e GrimDeck não oferecem juntos — esse é o fosso.
