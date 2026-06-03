# VaultSpell — Backlog do Projeto

Lista priorizada. Trabalhamos **aos poucos**, um item por vez, **um commit por feature**.
Esforço: 🟢 pequeno · 🟡 médio · 🔴 grande.

## ✅ Já entregue
**Coleção & cartas**
- Editar carta (+merge), valor da carta, coluna de Set + ícone, preview grande no hover, linhas/página, filtro por set
- Sets: ver cartas, adicionar individual ou set inteiro · Coleção → binder · Import/Export CSV (grimdeck)

**Social & compartilhamento**
- Amigos (por username/email, pedido/aceitar) + Compartilhar (coleção/binder/deck com amigos ou link público read-only)
- Links públicos bonitos e editáveis: `/p/username/slug`

**Contas & perfil**
- Recuperação de senha (email **ou** username, email no domínio próprio via Resend)
- Login por email **ou** username · confirmar senha + aviso de email no cadastro
- Editar conta (nome/nickname/email) · **Avatar** (galeria temática **+ upload** de imagem) · bio + links
- Página de **perfil público** `/u/username`

**Plataforma & marca**
- Rebrand **VaultSpell** (📖) + **domínio próprio** `vaultspell.com` (Render + email no domínio)
- **i18n completo** PT/EN/ES (todas as telas) · seletor de idioma
- Landing page pública · fundo animado de fagulhas · logo → home
- **Admin** (dashboard + gerenciar usuários: ativo/admin/premium)
- **Fale conosco / report de bugs** (form, anônimo ou logado) → visível no Admin
- Deploy no Render + docs (README/PRODUCT/ROADMAP) + topics no GitHub

**Monetização**
- **Premium (Stripe)** 🔴 — checkout + webhook + portal + página de planos (R$10/mês) + selos de segurança. _Test mode ativo._
- **Trocas & Vendas MVP** 🔴 — criar oferta (venda/troca) escolhendo da coleção/binder/deck/busca, **foto real**, vitrine pública + busca, "tenho interesse" (email pro vendedor), minhas ofertas. Criar = premium.

## 🎯 Próximos (prioridade)

### P1 — Qualidade & base
1. **Testes** 🔴 — backend (pytest: auth, coleção, amigos, shares, listings, billing) + frontend.
2. **Logs** 🟡 — logging estruturado (requests, erros, webhooks Stripe).
3. **Segurança** 🟡 — revisão de auth/JWT, autorização (ownership) nos endpoints, rate limit, headers, validação de input.
4. **Perf** 🟡 — resolução de cartas (N+1) em coleções grandes (export/share/listings) — usar batch/paginar mais.

### P2 — Monetização (continuação)
5. **Premium → produção** 🟢 — trocar chaves test por **live** (`sk_live`) + webhook live, quando for cobrar de verdade.
6. **Trocas Fase 2** 🔴 — matchmaking ("você tem o que ele quer") + **reputação/avaliações** entre quem troca.
7. **Trocas Fase 3** 🔴 — pagamento/escrow integrado (bem depois).
8. **Mais gates premium** 🟡 — definir o que mais é premium (ex: binders/decks ilimitados, histórico de valor) + limites do free.

### P3 — Diferenciais de produto (ver PRODUCT.md)
9. **Deck × coleção** (tem/falta/custo) 🟢 — alto valor, rápido
10. **Notificações de preço** (wishlist/variação/valor total) 🟡
11. **Categorias inteligentes** do deck (ramp/draw/removal…) 🟡
12. **Página pública do deck + QR + export** 🟡
13. **Sugestões estilo EDHREC** 🟡
14. **AI Deck Doctor** (análise/nota por IA) 🔴 — premium
15. **Deck DNA** (arquétipo) 🔴 — premium
16. **Builder ciente da coleção** (substituições) 🔴
17. **Scanner de cartas por câmera** 🔴 (paridade ManaBox)
18. **Primer do deck** (estratégia/win cons/mulligan/combos) 🟡 · **Playtest instantâneo** 🔴 · **Pile view** 🟡
19. **Localização física** (binder/página/slot) 🟡 · **Coleção familiar** 🔴
20. **Meta Simulator** 🔴 · **Trade Analyzer** 🟡 · **Evolução automática do deck** 🔴 · **IA de treino pós-partida** 🔴🔴

## ❌ Fora de escopo (decisão do usuário)
- Pokémon / outros TCGs · App mobile nativo · Scanner por código de barras

---

**Sugestão de ordem:** P1 (testes → logs → segurança) é o mais saudável agora que o app
está público e cobrando. Mas **Deck × coleção** (P3.9) é um quick win de alto valor.
Você escolhe o próximo e eu faço só ele.
