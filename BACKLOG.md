# MagicVault — Backlog do Projeto

Lista priorizada de tudo que foi pedido. Trabalhamos **aos poucos**, um item por
vez, com **um commit por feature**. Legenda de esforço: 🟢 pequeno · 🟡 médio · 🔴 grande.

## ✅ Já entregue
- Coleção: editar carta (+merge), valor da carta, coluna de Set, preview grande no hover, linhas/página, título "Coleção de {username}"
- Sets: ver cartas, adicionar individual ou set inteiro
- Coleção → binder
- Importar/Exportar CSV (formato grimdeck)
- Amigos + Compartilhamento (amigos por username/email, link público, view read-only)
- Landing page pública
- Logo → link pra home
- Deploy no Render + README com link ao vivo + PRODUCT.md + topics no GitHub + histórico sem menções a IA
- i18n: base + seletor de idioma + telas de entrada (nav, landing, login, registro) — _em finalização_

## 🎯 Próximos (prioridade)

### P0 — Terminar o que está em andamento / contas
1. **i18n — completar nas telas internas** 🟡
   Falta traduzir: coleção (tabela/filtros/modais), binders, decks, sets, wishlist, amigos, compartilhados, scan, search. (base e telas de entrada já prontas)
2. **Editar conta** 🟡 — mudar email, nome, nickname; **avatar** (galeria de avatares públicos com tema MTG/D&D).
3. **Página de perfil** 🟡 — bio, links e "coisas desse mundo"; visível no compartilhamento/perfil público.

### P1 — Qualidade & base (você sinalizou que vai pedir)
4. **Testes** 🔴 — backend (pytest: auth, coleção, amigos, shares) + frontend (componentes-chave).
5. **Logs** 🟡 — logging estruturado no backend (requests, erros, jobs), níveis por ambiente.
6. **Validação de segurança** 🟡 — revisão de auth/JWT, autorização nos endpoints (ownership), rate limit, headers, CORS de produção, validação de input.
7. **Perf**: view de coleção compartilhada com muitos cards (N+1 / paginar) 🟡.

### P2 — Monetização
8. **Premium (Stripe + gates)** 🔴 — flag de plano no usuário, checkout/webhook, travar recursos premium, limites do free. (ver PRODUCT.md)

### P3 — Diferenciais de produto (ver PRODUCT.md / ROADMAP.md)
9. **Deck × coleção** (collection-aware: tem/falta/custo) 🟢
10. **Notificações de preço** (wishlist/variação/valor total) 🟡
11. **Categorias inteligentes** do deck (ramp/draw/removal…) 🟡
12. **Página pública do deck + QR + export** 🟡
13. **Sugestões estilo EDHREC** 🟡
14. **AI Deck Doctor** (análise/nota por IA) 🔴 — premium
15. **Deck DNA** (arquétipo) 🔴 — premium
16. **Builder ciente da coleção** (substituições) 🔴
17. **Scanner de cartas por câmera** 🔴

## ❌ Fora de escopo (decisão do usuário)
- Pokémon / outros TCGs · App mobile nativo · Scanner por código de barras

---

**Sugestão de ordem:** P0 (i18n → conta → perfil) → P1 (testes → logs → segurança)
→ P2 (premium) → P3 (diferenciais). Mas você manda — escolhe o próximo e eu faço só ele.
