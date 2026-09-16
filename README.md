# Helpdesk Ticket Management System (Backend)

A generic backend for a small IT helpdesk that receives a large volume of
support tickets and needs its queue to always surface the **most
pressing ticket first** — automatically, without anyone manually
re-prioritizing rows in a database.

This repository contains a FastAPI + PostgreSQL backend and a Vite/React
frontend.

---

## 1. Project Overview

Support tickets come in with a priority (`normal`, `high`, or `urgent`), and each
priority carries a **response SLA**:

- `normal` → must be responded to within **24 hours**
- `high` → must be responded to within **8 hours**
- `urgent` → must be responded to within **2 hours**

The moment a ticket is created, the server computes its `due_at`
deadline from `created_at + SLA`. Clients never supply `due_at` — the
server is the sole source of truth for deadlines.

As tickets sit in the queue, some blow past their deadline. Those
**overdue** tickets need to visibly and automatically jump to the front
of the queue, ahead of tickets that are still within their promised
response window — without anyone flipping a status flag by hand.

The system also lets staff filter by overdue/priority/status/assignee,
search by customer or free text, and page through large result sets —
all while preserving that same "most pressing first" ordering.

---

## 2. Architecture

```text
                    ┌─────────────────────┐
                    │      FastAPI        │   app/api/routes/*.py
                    │      API Layer      │   - thin: parse, delegate, map errors
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Service Layer     │   app/services/*.py
                    │                     │
                    │ TicketService       │   - SLA calc, create/update rules
                    │ QueueService        │   - THE central ordering rule
                    │ AssignmentService   │   - assignment orchestration
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Repository / ORM    │   app/repositories/*.py
                    │                     │   - SQLAlchemy 2.x queries
                    │                     │   - filter → order → paginate,
                    │                     │     all in the database
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    └─────────────────────┘
```

**Frontend**: not included in this repository. The API is a standard
JSON/REST API (`/docs` for interactive Swagger UI) that any frontend can
consume.

**API layer** (`app/api/`): FastAPI route handlers. They validate input
via Pydantic, call into the service layer, translate domain exceptions
(`TicketNotFoundError`, `UserNotFoundError`, ...) into the right HTTP
status codes, and serialize the response. No business logic lives here.

**Service layer** (`app/services/`):
- `TicketService` — ticket creation, SLA/`due_at` calculation, partial
  updates (including the documented priority-change/SLA-recalculation
  rule), and orchestrating paginated queue reads.
- `QueueService` — **the single centralized definition of queue
  ordering** (see below). Both a SQLAlchemy `ORDER BY` builder and an
  equivalent pure-Python `sort_key()` live here, so unit tests can
  exercise the exact same rule the database uses.
- `AssignmentService` — thin orchestration for "who can be assigned" /
  "assign this ticket to that user".

**Repository layer** (`app/repositories/`): all actual SQL. Filtering
happens as `WHERE` clauses; ordering is delegated to `QueueService`
(never duplicated here); pagination is `OFFSET`/`LIMIT` applied last.
Nothing is loaded into Python and then sorted/sliced in application
code.

**Database**: PostgreSQL, via SQLAlchemy 2.x models and Alembic
migrations. `Priority` and `Status` are native Postgres enums.
`overdue` is **not** a stored column — see §4.

---

## 3. Queue Ordering — the core business rule

This is the most important part of the system. It lives in exactly one
place: [`app/services/queue_service.py`](backend/app/services/queue_service.py)
(`QueueService.apply_ordering` for SQL, `QueueService.sort_key` for the
equivalent in-memory comparison used in tests). **Every** endpoint that
returns a list of tickets — the main queue, `overdue=true`,
`assigned_to=...`, `customer=...`, `search=...` — routes through this
same function. Filtering only narrows the candidate set; it never
changes what "most pressing first" means for whatever remains.

### The rule, in order:

```text
1. Overdue tickets before non-overdue tickets
2. Within the same overdue-ness: urgent before high before normal
3. Earlier due_at before later due_at
4. Older created_at before newer created_at   (deterministic tie-break)
5. Lower id before higher id                  (final deterministic tie-break)
```

A ticket is **overdue** when `due_at < now` AND its status is not
`resolved`/`closed` (see §4 — this is computed, not stored).

### Worked example (from the spec)

If the current time is **3:00 PM**:

```text
T1 → NORMAL → due 2:00 PM → OVERDUE
T2 → URGENT → due 5:00 PM → NOT OVERDUE
T3 → NORMAL → due 4:00 PM → NOT OVERDUE
T4 → URGENT → due 3:30 PM → NOT OVERDUE
```

Resulting queue: **T1, T4, T2, T3**

- T1 is first: it's the only overdue ticket.
- T4 is next: among the non-overdue tickets, it's urgent with the
  earliest due_at.
- T2 is next: also urgent, but due later than T4.
- T3 is last: normal priority, non-overdue.

This exact scenario is `test_worked_example_from_spec` in
`tests/unit/test_queue_order.py`.

### SQL shape (conceptually)

```sql
ORDER BY
    CASE
        WHEN due_at < CURRENT_TIMESTAMP
             AND status NOT IN ('resolved', 'closed')
        THEN 0 ELSE 1
    END,
    CASE
      WHEN priority = 'urgent' THEN 0
      WHEN priority = 'high' THEN 1
      ELSE 2
    END,
    due_at ASC,
    created_at ASC,
    id ASC
```

`QueueService.apply_ordering` builds this with SQLAlchemy `case()`
expressions rather than a raw string, so it composes with whatever
`WHERE` clause the repository has already built for the current filters.

### Why centralize it?

If ordering logic were duplicated across `GET /tickets`,
`GET /tickets?overdue=true`, the assignee filter, and search, it would
inevitably drift — one endpoint would forget the resolved/closed
exception, another would tie-break differently. Centralizing it in
`QueueService` means:

- There is exactly one place to read to understand "what does the queue
  do", and exactly one place to fix if the rule ever changes.
- Unit tests (`tests/unit/test_queue_order.py`) can pin down the rule's
  behavior once, with a controllable fake clock, and every endpoint that
  calls `QueueService` inherits that correctness for free.
- The ordering is always expressed as a database `ORDER BY`, so it stays
  efficient (uses indexes, no "load everything into Python and sort")
  even as the ticket table grows to hundreds of thousands of rows.

---

## 4. Overdue is derived, not stored

There is no `is_overdue` column. Storing it would mean either a
background job to keep it in sync, or a bug window where a ticket that
just crossed its deadline still reads as "not overdue" until something
re-computes it.

Instead:

- `QueueService.overdue_expression(now)` returns a SQL boolean
  expression: `due_at < now AND status NOT IN ('resolved', 'closed')`.
- `QueueService.is_overdue(ticket, now)` is the same logic for a single
  Python object (used when serializing API responses).
- The API always exposes a computed `"overdue": true/false` field on
  every ticket in every response.
- A ticket that gets resolved/closed **stops** counting as overdue
  immediately, even if its original `due_at` is long past — it already
  got a resolution and shouldn't clutter the "at risk" view.

`due_at` itself is set once at creation (or recalculated on a documented
priority change, see §6) and is never silently mutated by a background
process.

---

## 5. Database schema

**`users`** — helpdesk employees.

```text
id, name, email (unique), password_hash, created_at
```

**`tickets`**

```text
id, customer_name, customer_email, title, description,
priority (enum: urgent|high|normal), status (enum: open|in_progress|resolved|closed),
created_at, due_at, updated_at, assigned_to (FK -> users.id, ON DELETE SET NULL)
```

Indexes (see the initial Alembic migration for the exact DDL):

- Single-column: `due_at`, `priority`, `status`, `assigned_to`,
  `customer_name`, `created_at`, `users.email` (unique)
- Composite, tuned for the queries this API actually runs:
  `(status, due_at)`, `(priority, status)`, `(assigned_to, status)`

`customer_name` search uses `ILIKE '%term%'` for case-insensitive
partial matching (`Amit`, `amit`, `AMIT`, `Amit Sharma` all match "Amit
Sharma"). General `search` matches `title`, `description`,
`customer_name`, and `customer_email` the same way.

---

## 6. API

Interactive docs: `GET /docs` (Swagger) and `GET /redoc` once the server
is running.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check → `{"status": "ok"}` |
| POST | `/api/auth/login` | Login with email/password and receive a Bearer token |
| GET | `/api/tickets` | The queue: filter + order + paginate |
| GET | `/api/tickets/stats` | Dashboard summary counts |
| POST | `/api/tickets` | Create a ticket (server computes `due_at`) |
| GET | `/api/tickets/{id}` | Get one ticket |
| PATCH | `/api/tickets/{id}` | Partial update (title/description/priority/status/assigned_to) |
| POST | `/api/tickets/{id}/assign` | Assign (`{"user_id": N}`) or unassign (`{"user_id": null}`) |
| GET | `/api/users` | List helpdesk employees |

### `GET /api/tickets` query parameters

```text
page          default 1
page_size     default 20, max 100
priority      urgent | high | normal
status        open | in_progress | resolved | closed
overdue       true | false
assigned_to   user id
customer      case-insensitive partial match on customer_name
search        matches title/description/customer_name/customer_email
```

All results are filtered, then ordered via `QueueService`, then
paginated — in that order, in the database.

### Automated escalation

The application checks overdue active tickets every 60 seconds. Each run
raises a breached ticket by exactly one level: `normal -> high -> urgent`.
Urgent tickets stay urgent, and resolved/closed tickets are skipped. A
priority change recalculates `due_at` from the original `created_at`, so a
later run can escalate the same ticket again without jumping multiple levels
in one run. Seeded users use the demo password `Project`.

### Priority-change SLA behavior (documented, per spec §9)

`PATCH /api/tickets/{id}` with a new `priority` recalculates `due_at`
**from the ticket's original `created_at`**, using the new priority's
SLA. Example: a `normal` ticket created at 9:00 AM (due 9:00 AM next
day) gets bumped to `urgent` at 2:00 PM the same day → its `due_at`
becomes 11:00 AM (created_at + 2h), not "now + 2h". This keeps `due_at`
consistent with "the deadline this ticket is currently promised under",
rather than resetting the clock every time someone touches the ticket.
See `TicketService.update_ticket` for the implementation and
`test_7_priority_change_updates_ordering` / `test_update_priority_recalculates_due_at`
for the tests.

### Example requests

```bash
# Health check
curl http://localhost:8000/api/health

# Create an urgent ticket
curl -X POST http://localhost:8000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
        "customer_name": "Amit Sharma",
        "customer_email": "amit@example.com",
        "title": "Laptop won'"'"'t boot",
        "description": "Laptop is not starting before client demo",
        "priority": "urgent"
      }'

# The main queue, paginated
curl "http://localhost:8000/api/tickets?page=1&page_size=20"

# Overdue tickets only
curl "http://localhost:8000/api/tickets?overdue=true"

# Tickets assigned to user 3
curl "http://localhost:8000/api/tickets?assigned_to=3"

# Tickets for a customer (partial, case-insensitive)
curl "http://localhost:8000/api/tickets?customer=amit"

# Combined filters
curl "http://localhost:8000/api/tickets?priority=urgent&status=open&overdue=true"

# Free-text search
curl "http://localhost:8000/api/tickets?search=laptop"

# Assign a ticket
curl -X POST http://localhost:8000/api/tickets/1/assign \
  -H "Content-Type: application/json" -d '{"user_id": 3}'

# Unassign
curl -X POST http://localhost:8000/api/tickets/1/assign \
  -H "Content-Type: application/json" -d '{"user_id": null}'

# Change status / priority
curl -X PATCH http://localhost:8000/api/tickets/1 \
  -H "Content-Type: application/json" -d '{"status": "in_progress"}'

# Dashboard stats
curl http://localhost:8000/api/tickets/stats
```

### Error shape

```json
{ "detail": "Ticket not found" }
```

Validation errors return `422` with FastAPI's standard error-list shape.
Unknown ticket/user ids return `404`/`400` with a clean message — no
stack traces or SQL are ever exposed to clients (see
`app/main.py`'s exception handlers; server-side, the real exception is
logged).

---

## 7. Setup (Docker)

```bash
git clone <repo-url>
cd helpdesk-ticket-system
cp .env.example .env   # adjust if needed
docker compose up --build
```

This starts:

- `db` — PostgreSQL 16, with a healthcheck
- `backend` — runs `alembic upgrade head` then starts `uvicorn` on
  `http://localhost:8000`

Then seed sample data:

```bash
docker compose exec backend python -m app.seed
```

Visit `http://localhost:8000/docs` for interactive API docs.

> This repository has no frontend container. If/when one is added, wire
> it into `docker-compose.yml` alongside `backend`/`db`.

---

## 8. Local backend development (without Docker)

Requires Python 3.12+ and a local PostgreSQL instance.

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Point at your local Postgres (create the DB first, e.g. `createdb helpdesk`)
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/helpdesk

./venv/bin/alembic upgrade head
./venv/bin/python -m app.seed
./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`Makefile` shortcuts (from the repo root): `make venv`, `make migrate`,
`make seed`, `make run`, `make test`, `make lint`, `make format`.

---

## 9. Database migrations (Alembic)

```bash
cd backend
./venv/bin/alembic upgrade head                 # apply migrations
./venv/bin/alembic revision --autogenerate -m "description"   # new migration
./venv/bin/alembic downgrade -1                  # roll back one step
```

`alembic/env.py` reads `DATABASE_URL` from the same application settings
as the app itself (`app.core.config.get_settings()`), so migrations
never depend on a separately hard-coded connection string.

---

## 10. Seed data

```bash
cd backend
./venv/bin/python -m app.seed
```

Creates 10 helpdesk employees and 500 tickets, explicitly guaranteeing at
least one ticket in every combination the queue logic cares about
(overdue/not-overdue × urgent/high/normal × assigned/unassigned, plus
resolved and closed tickets), with the rest randomized across realistic
customers and issue types. Running it again clears and re-seeds.

---

## 11. Testing

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/helpdesk_test
./venv/bin/pytest -v
```

Tests run against a **real PostgreSQL database** (not SQLite), so the
actual `ORDER BY`/`WHERE` SQL is what gets verified — not an
approximation of it. `tests/conftest.py` provides a controllable fake
clock (`override_clock` / `advance_clock` / `reset_clock` from
`app.utils.datetime`) so overdue/queue behavior is deterministic instead
of racing real time.

- `tests/unit/test_queue_order.py` — the 8 mandatory queue test cases
  from the spec (overdue-before-non-overdue, urgent-before-normal within
  overdue, priority ordering, due_at tie-breaks, deterministic exact
  ties, resolved/closed exclusion, priority-change re-ordering,
  clock-advancement reclassification) plus the worked example.
- `tests/unit/test_ticket_service.py` — SLA calculation, that
  `create_ticket()` has no `due_at`/`created_at` parameters at all (the
  server can't be handed a deadline even if it wanted to), assignment
  validation, and update semantics.
- `tests/integration/test_ticket_api.py` — full HTTP-level coverage:
  create/get/update/assign, every filter individually and combined,
  general/customer search, pagination (no duplicates/gaps across pages,
  correct totals, max page-size enforcement, invalid page rejection,
  stable ordering across pages), dashboard stats, and 404/422/400 error
  paths.

At last run: **47 passed**.

---

## 12. Design decisions

- **Why is queue ordering one centralized service instead of per-route
  logic?** Because "most pressing ticket first" is the entire point of
  the product. Scattering it across route handlers means it will drift
  the first time someone adds a new filtered endpoint and forgets one
  clause. `QueueService` is the only place that decides ordering, in
  both its SQL (`apply_ordering`) and Python (`sort_key`) forms, and
  every list-returning endpoint calls it.
- **Why derive `overdue` instead of storing it?** A stored flag needs a
  background job to stay correct, and will always have a window where
  it's stale. Deriving it from `due_at < now AND status not in
  (resolved, closed)` means it's *always* correct, for free, and trivial
  to test with a fake clock.
- **Why recalculate `due_at` from the original `created_at` on a
  priority change, rather than from "now"?** `due_at` should always
  answer "what deadline is this ticket currently promised under", which
  is a function of when it was created and its current priority — not
  of when someone happened to edit it.
- **Why filter → order → paginate entirely in the database?** The spec
  may involve hundreds of thousands of tickets. Loading everything into
  Python to sort and slice would be O(n) memory and CPU on every page
  request; doing it in SQL lets Postgres use the composite indexes and
  return only the requested page.
- **Why no Redis/Celery/Elasticsearch/microservices?** Nothing in the
  requirements needs them yet. A well-indexed Postgres table handles
  filtering, ordering, and full-text-ish `ILIKE` search at this scale
  without the operational overhead of extra infrastructure.
