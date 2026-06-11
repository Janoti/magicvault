# Deploy do VaultSpell (VPS dedicado)

O VaultSpell roda num **VPS dedicado**, publicado em **https://vaultspell.com**.
O FastAPI serve a SPA React buildada + a API na **mesma origem** (sem CORS, chamadas
relativas a `/api`). Postgres e Redis sobem junto via `docker compose`.

## Arquitetura em produção

```
Navegador ──HTTPS──> vaultspell.com (VPS)
                        ├─ FastAPI  → /api/*
                        └─ SPA      → /  (estáticos em /app/static, buildados no Dockerfile raiz)
                                        │
                        ┌───────────────┘
                        ▼
                 Postgres + Redis (containers no mesmo host)
```

- O frontend é buildado com `VITE_API_URL=""`, então chama `/api/...` na mesma
  origem — **sem CORS, sem URL cruzada**.
- O Redis é **best-effort** (cache do Scryfall). Se ficar indisponível, o app
  continua funcionando, só sem cache.
- As tabelas do banco são criadas no startup (`Base.metadata.create_all`), não
  precisa rodar migração manual.

## Deploy é manual (não há auto-deploy)

Um `git push` pro GitHub é só a **fonte do código** — ele **não** publica nada.
Pra subir uma versão nova, é preciso atualizar o VPS:

```bash
ssh <user>@<ip-do-vps>          # acesso ao servidor
cd <caminho-do-repo-no-vps>     # ex.: /opt/magicvault ou ~/magicvault
git pull                        # traz os commits novos
./deploy.sh                     # script de deploy do servidor
```

O script de deploy do servidor faz, em resumo, `git pull` + rebuild + restart dos
containers (`docker compose up -d --build`). Ajuste o nome/caminho do script
conforme o que está no VPS.

> Fluxo de trabalho: commit local → `git push origin main` → SSH no VPS → `git pull` →
> rodar o script de deploy.

## Variáveis de ambiente

Ficam num `.env` no servidor (não versionado). Principais:

| Variável | Função |
|---|---|
| `DATABASE_URL` | Postgres (normalizada p/ asyncpg no código) |
| `REDIS_URL` | Redis (cache, best-effort) |
| `SECRET_KEY` | assinatura de tokens |
| `ENVIRONMENT` | `production` |
| `anthropic_api_key` / `xai_api_key` | LLM do Deck Doctor (opcional) |

## Rodar localmente (dev)

```bash
docker compose up -d            # backend :8000 (--reload) + frontend :5173
```

Testar a imagem de produção combinada (SPA + API juntos) localmente:

```bash
docker build -t vaultspell-web .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://magicvault:magicvault123@host:5432/magicvault \
  -e REDIS_URL=redis://host:6379 -e SECRET_KEY=dev vaultspell-web
# abre http://localhost:8000  (SPA + API na mesma origem)
```
