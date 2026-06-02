# Deploy do MagicVault no Render

O MagicVault é publicado como **um único web service**: o FastAPI serve a SPA
React buildada + a API na mesma origem. Mais Postgres e Redis gerenciados.
Tudo está declarado em [`render.yaml`](./render.yaml).

## Arquitetura em produção

```
Navegador ──HTTPS──> Render Web Service (magicvault)
                        ├─ FastAPI  → /api/*
                        └─ SPA      → /  (arquivos estáticos em /app/static)
                                        �│
                        ┌───────────────┘
                        ▼
            Postgres (magicvault-db) + Redis (magicvault-redis)
```

- O frontend é buildado com `VITE_API_URL=""`, então chama `/api/...` na mesma
  origem — **sem CORS, sem URL cruzada entre serviços**.
- O Redis é **best-effort** (cache do Scryfall). Se ficar indisponível, o app
  continua funcionando, só sem cache.

## Pré-requisitos
1. Conta no **GitHub** com o repositório `Janoti/magicvault` (este repo).
2. Conta no **Render** (https://render.com) — pode logar com o GitHub.

## Passos

### 1. Suba o código pro GitHub
Se ainda não fez:
```bash
git push -u origin main
```

### 2. Crie o Blueprint no Render
1. No dashboard do Render: **New +  →  Blueprint**.
2. Conecte/escolha o repositório `Janoti/magicvault`.
3. O Render lê o `render.yaml` e mostra os 3 recursos que vai criar
   (web `magicvault`, `magicvault-db`, `magicvault-redis`). Clique **Apply**.
4. Aguarde o build (alguns minutos — ele builda o frontend e a imagem Docker).

### 3. Pronto
- A URL fica tipo `https://magicvault.onrender.com`.
- O healthcheck usa `/api/health`.
- As tabelas do banco são criadas automaticamente no startup (via
  `Base.metadata.create_all`), não precisa rodar migração.

## Variáveis de ambiente (já configuradas pelo render.yaml)
| Variável | Origem |
|---|---|
| `DATABASE_URL` | injetada do Postgres (`magicvault-db`) — normalizada p/ asyncpg no código |
| `REDIS_URL` | injetada do Redis (`magicvault-redis`) |
| `SECRET_KEY` | gerada automaticamente pelo Render |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | `*` (irrelevante no deploy single-origin) |

## Observações sobre o plano free
- **Web free**: "dorme" após ~15 min sem acesso; a 1ª request depois acorda
  (alguns segundos de espera). Para sempre-ligado, suba o plano do web service.
- **Postgres free**: expira após ~30 dias. Para manter os dados, faça upgrade
  do banco antes disso.
- **Redis free**: 25 MB, suficiente pro cache.

## Atualizações futuras
Todo `git push` na branch conectada dispara um novo deploy automático no Render.

## Rodar localmente (continua igual)
```bash
docker compose up -d            # dev: backend :8000 + frontend :5173
```
Ou testar a imagem de produção combinada localmente:
```bash
docker build -t magicvault-web .
docker run --rm -p 8000:8000 --network magicvault_default \
  -e DATABASE_URL=postgresql+asyncpg://magicvault:magicvault123@postgres:5432/magicvault \
  -e REDIS_URL=redis://redis:6379 -e SECRET_KEY=dev magicvault-web
# abre http://localhost:8000  (SPA + API juntos)
```
