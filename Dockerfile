# Combined production image: builds the React SPA and serves it from FastAPI
# on a single origin. Build context must be the repo root.

# 1) Build the frontend
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Empty API URL => the SPA makes same-origin requests ("/api/...") in production
ENV VITE_API_URL=""
RUN npm run build

# 2) Backend + bundled frontend
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy the built SPA so main.py can serve it (STATIC_DIR = /app/static)
COPY --from=frontend /fe/dist ./static

EXPOSE 8000
# Render injects $PORT; default to 8000 for local runs.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
