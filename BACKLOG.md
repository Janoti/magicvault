# VaultSpell — Backlog

Trabalhamos **aos poucos**, um item por vez, **um commit por feature**.
Esforço: 🟢 pequeno · 🟡 médio · 🔴 grande.

> **🎯 Posicionamento (insight da pesquisa de mercado):** nenhuma ferramenta une
> bem **deck builder + gerenciador de coleção + mercado** num só lugar (a coleção
> do Moxfield é "afterthought"; o ManaBox é scanner-first). **O VaultSpell faz
> exatamente isso** — é o nosso diferencial. Toda feature nova deve reforçar a
> integração coleção ↔ deck ↔ binder ↔ mercado.

---

## ✅ Já entregue

**Coleção & cartas**
- Coleção (editar/merge, valor, set+ícone, preview no hover, paginação, **lista/grade**, **valor total USD+R$**)
- Filtros: nome, set, raridade, **tipo**, condição, foil · **ordenação por tudo (persiste no refresh)**
- **Tags de função** por carta (ramp/remoção/finisher…) · **chips de binder** na linha
- Preços USD + **R$** com link pra loja oficial · Import/Export CSV (grimdeck)
- **Busca por nome + por efeito/habilidade** (oracle) + chips de habilidades

**Decks**
- Decks de qualquer formato · **importar colando lista** (Moxfield/Arena) · **exportar** (.txt/copiar)
- **Análise** (curva, cores, tipos, funções por carta) · **Deck × coleção** (tem/falta/custo)
- **Comparar** com decks de amigos/públicos (veredito) · **Sugestões EDHREC** (marca o que você tem)
- **AI Deck Doctor** (Claude/Grok, premium, cacheado) · **Playtest** · **Pile view** · **Primer**
- Deixar deck público · localização nos cards

**Binders**
- Binders temáticos com valor · add carta da coleção · **localização física (página/slot)**

**Social & mercado**
- Amigos · compartilhar (amigos/link público) · links `/p/user/slug` · página compartilhada (paginação + zoom)
- **Vitrine no perfil**: decks/coleção públicos (`/u/`, `/d/`, `/c/`) · **QR** do link
- **Trades & Vendas** (premium): foto real, venda/troca, **busca de cartas pra troca**, **aceita proposta**
- **Chat** comprador↔vendedor (+ **email** ao responder) · resolver (vendido/trocado/cancelado) · stats

**Wishlist**
- Busca **dinâmica** embutida · ações (já comprei→coleção, pro deck, remover)
- **Monitor de mercado** (nosso + externo) · **alertas de preço** (subiu/caiu + preço-alvo)

**Plataforma**
- i18n PT/EN/ES · recuperação de senha · conta/avatar/bio/links/**contato (WhatsApp)**
- **Premium (Stripe)** R$10/mês + **beta grátis pros 50 primeiros**
- **Admin** (stats, editar email, deletar conta) · Fale conosco/bugs
- Rebrand VaultSpell + domínio próprio · **landing + /features** · **menu modernizado**
- **Fundo de art de cartas rotacionando** (landing + login)

**Qualidade & segurança**
- Hardening (XSS, webhook, path traversal, ownership, caps, headers) · **rate limiting**
- **Testes** (pytest: smoke, auth, segurança/IDOR, decks, friends — 27 passando; plano em `TESTS.md`)
- **Logs estruturados** (JSON em produção, request id) · perf da coleção (N+1 resolvido)

---

## 🎯 Próximas features (priorizadas pela pesquisa de mercado)

> Fontes: Draftsim, GrimDeck, reviews ManaBox/Moxfield/Archidekt. Dores reais citadas.

### Quick wins 🟢 — alto valor, dor citada, baratos
1. **Seletor de edição/arte da carta** — trocar a printing no deck/coleção sem remover+adicionar. *(Dor #1 citada no ManaBox/Moxfield.)*
2. **Pastas de decks** + **compartilhar pasta inteira**. *(Moxfield NÃO faz → diferencial.)*
3. **Edição/precificação em massa** na coleção (bulk).

### Médio 🟡
4. **Vínculo vivo** deck ↔ binder ↔ coleção (mudança reflete dos dois lados). *(Pedido ManaBox.)*
5. **Gráfico de valor da coleção no tempo** (snapshots + cron — junta com **alertas por email**).
6. **Metagame**: aba de decks populares por formato.
7. **PWA**: instalável + offline básico (sem app nativo). *(TopDecked tem offline.)*
8. **Trades Fase 2 — reputação/avaliações** entre quem troca.
9. **AI Artifacts Fase 1** — Deck Doctor em JSON → sugestões viram botões (+wishlist/mercado). *(Dá pra mockar sem gastar IA.)*

### Grande 🔴
10. **Scanner por câmera** — com **fallback manual + reconhecimento de set** (onde o ManaBox falha = oportunidade).
11. **Playtest multiplayer / goldfish avançado** (zonas, mulligan, ações). *(ManaStack tem, é elogiado.)*
12. **Coleção familiar** (compartilhar/gerenciar entre pessoas).
13. **Deck DNA / assistente conversacional** (IA avançada) · **Trade Analyzer** · **Meta Simulator**.

### Base contínua
14. **Expandir testes** (collection, wishlist, trades, **webhook billing**) — seguir `TESTS.md`.
15. **Premium → produção** (sk_live + créditos IA) — quando for cobrar.

## ❌ Fora de escopo (decisão do usuário)
Pokémon/outros TCGs · app mobile nativo · scanner por código de barras

---

**Sugestão de ordem:** 🟢 #1 (seletor de edição) → #2 (pastas de decks, que o Moxfield
não tem) → #5/#9. As 🔴 (scanner, multiplayer, familiar) são projetos por si só —
encarar só se forem prioridade de produto.
