# Helpdesk Ticket Management System

An interactive helpdesk application with a FastAPI/PostgreSQL backend and a
React/Vite frontend. The system calculates ticket SLAs, keeps the queue sorted
by operational urgency, and automatically escalates overdue tickets.

## Features

- Password-based Bearer-token authentication.
- Ticket priorities and SLAs:
  - `normal`: 24 hours
  - `high`: 8 hours
  - `urgent`: 2 hours
- Derived overdue status. Resolved and closed tickets are never overdue.
- Canonical queue ordering:
  1. Overdue before on-time
  2. Urgent before High before Normal
  3. Earlier `due_at`
  4. Older `created_at`
  5. Lower ticket ID
- Automatic escalation every 60 seconds:
  - `normal -> high`
  - `high -> urgent`
  - `urgent -> urgent`
- Each escalation run changes a ticket by at most one level.
- Search, filtering, assignment, pagination, dashboard statistics, and a
  responsive frontend.

## Architecture

```text
React/Vite frontend :3000
          |
          | JSON + Authorization: Bearer <token>
          v
FastAPI backend :8000
          |
          v
PostgreSQL :5432
```

Backend layers:

- `backend/app/api/`: HTTP routes and request validation.
- `backend/app/services/`: SLA, queue, assignment, and escalation rules.
- `backend/app/repositories/`: SQLAlchemy queries.
- `backend/app/models/`: database models and enums.
- `backend/alembic/`: database migrations.
- `frontend/src/`: React pages, API client, authentication, and controls.

## Run With Docker

From the repository root:

```powershell
docker compose up --build
```

Docker starts PostgreSQL, runs Alembic migrations, and starts FastAPI.

Backend URLs:

- API: http://localhost:8000
- Health: http://localhost:8000/api/health
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

In a second terminal, start the frontend:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Frontend URL:

- http://localhost:3000

The frontend uses `VITE_API_BASE_URL`, which defaults to
`http://localhost:8000`.

## Seed Data

The seeder creates 10 employees and 500 tickets. It guarantees High-priority
tickets in overdue and non-overdue states, with assigned and unassigned
examples. It also creates Normal and Urgent examples.

```powershell
docker compose exec backend python -m app.seed
```

Important: the seeder clears existing users and tickets before recreating the
dataset.

All seeded users use:

```text
Password: Project
```

Example seeded login:

```text
Email:    priya.patel@helpdesk.example.com
Password: Project
```

## Authentication

Login:

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "priya.patel@helpdesk.example.com",
  "password": "Project"
}
```

Response:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

Send the token on protected requests:

```http
Authorization: Bearer eyJ...
```

Protected endpoints require a valid token. The frontend intentionally requires
the user to click Sign In after each page load instead of automatically
restoring a stored session.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login and receive an access token |
| GET | `/api/users` | List helpdesk employees |
| GET | `/api/tickets` | Filtered, ordered, paginated queue |
| GET | `/api/tickets/stats` | Dashboard statistics |
| POST | `/api/tickets` | Create a ticket |
| GET | `/api/tickets/{id}` | Get one ticket |
| PATCH | `/api/tickets/{id}` | Update ticket fields |
| POST | `/api/tickets/{id}/assign` | Assign or unassign a ticket |

Ticket list query parameters:

```text
page          default 1
page_size     default 20, maximum 100
priority      normal | high | urgent
status        open | in_progress | resolved | closed
overdue       true | false
assigned_to   user ID
customer      partial customer-name match
search        title, description, customer, or email search
```

Create a ticket:

```http
POST /api/tickets
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "customer_name": "Alice Johnson",
  "customer_email": "alice@example.com",
  "title": "VPN is not working",
  "description": "Cannot connect from the home office.",
  "priority": "high"
}
```

The client must not send `created_at` or `due_at`; the backend calculates
those values.

Update a ticket:

```json
{
  "priority": "urgent",
  "status": "in_progress",
  "assigned_to": 3
}
```

To unassign a ticket:

```json
{
  "assigned_to": null
}
```

## Automated Escalation

The escalation loop runs inside the FastAPI application every 60 seconds.
For each active overdue ticket, it:

1. Reads the current priority.
2. Raises it by one level only.
3. Recalculates `due_at` from the original `created_at` and new SLA.
4. Saves the changed ticket.

Resolved and closed tickets are ignored. An overdue Normal ticket becomes High
on one run, not Urgent. If it remains overdue, a later run can move it from
High to Urgent.

This behavior is implemented in:

- `backend/app/services/ticket_service.py`
- `backend/app/main.py`
- `backend/app/repositories/ticket_repository.py`

## Local Backend Development

Requires Python 3.12+ and PostgreSQL:

```powershell
Set-Location .\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

For local development, set `DATABASE_URL` to a reachable PostgreSQL database.

## Migrations

Docker applies migrations automatically. To run them manually:

```powershell
Set-Location .\backend
alembic upgrade head
```

The current migration adds:

- `high` to the `ticket_priority` enum.
- `users.password_hash`.

## Verification

Frontend:

```powershell
Set-Location .\frontend
npm run lint
npm run build
```

Backend:

```powershell
Set-Location .\backend
python -m compileall app tests
ruff check app tests
```

Live check:

```powershell
Invoke-WebRequest http://localhost:8000/api/health
```

The frontend is available at http://localhost:3000 after `npm run dev`.
