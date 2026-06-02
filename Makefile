.PHONY: up down build logs shell-api shell-db migrate reset

# Start all services (development)
up:
	docker compose up --build

# Start detached
up-d:
	docker compose up --build -d

# Stop all
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

logs-api:
	docker compose logs -f backend

# Shell into containers
shell-api:
	docker compose exec backend bash

shell-db:
	docker compose exec postgres psql -U magicvault -d magicvault

# Run migrations manually
migrate:
	docker compose exec backend alembic upgrade head

# Create new migration
migration:
	docker compose exec backend alembic revision --autogenerate -m "$(name)"

# Full reset (drop volumes)
reset:
	docker compose down -v
	docker compose up --build

# Copy .env
env:
	cp .env.example .env
	@echo "Edit .env with your settings"
