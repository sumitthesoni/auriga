.PHONY: up down build logs test lint format migrate seed shell

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f backend

# --- Local (non-Docker) backend development ---------------------------------

venv:
	cd backend && python3 -m venv venv && ./venv/bin/pip install --upgrade pip && ./venv/bin/pip install -r requirements.txt

test:
	cd backend && DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/helpdesk_test ./venv/bin/pytest -v

lint:
	cd backend && ./venv/bin/ruff check app tests

format:
	cd backend && ./venv/bin/black app tests

migrate:
	cd backend && ./venv/bin/alembic upgrade head

seed:
	cd backend && ./venv/bin/python -m app.seed

run:
	cd backend && ./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

shell:
	docker compose exec backend /bin/sh
