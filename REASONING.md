# Solution Reasoning

## Goal

Build a full-stack helpdesk ticket system with a responsive frontend, a FastAPI backend, PostgreSQL persistence, SLA-based queue ordering, authentication, and automatic escalation.

## Main Design Decisions

### 1. Server-owned SLA deadlines

The backend calculates `created_at` and `due_at` when a ticket is created. Clients do not provide these values. This keeps deadline calculation authoritative and prevents clients from manipulating SLA dates.

Current SLA values:

- Normal: 24 hours
- High: 8 hours
- Urgent: 2 hours

### 2. Centralized queue ordering

Queue ordering is implemented in `QueueService` so every filtered ticket list uses the same rule:

1. Overdue active tickets first.
2. Urgent before High before Normal.
3. Earlier due dates first.
4. Older creation dates first.
5. Lower IDs first.

`overdue` is derived from `due_at` and status instead of stored as a database column. Resolved and closed tickets are excluded from overdue handling.

### 3. One-level automated escalation

The escalation rule is implemented as a business operation, not as a filter. A periodic application task scans active overdue tickets and changes their priority:

```text
Normal -> High
High -> Urgent
Urgent -> Urgent
```

Each run evaluates each ticket once, so a ticket can increase by at most one level per run. The next run can escalate it again if it remains overdue.

When priority changes, `due_at` is recalculated from the original `created_at` using the new SLA. This keeps the deadline consistent with the ticket's current priority.

### 4. Authentication

The API uses email/password login and returns a JWT Bearer token. Passwords are stored as PBKDF2-SHA256 hashes. Protected endpoints require:

```http
Authorization: Bearer <access_token>
```

The demo seeded password is `Project`.

### 5. Database migration

A migration adds:

- `high` to the PostgreSQL ticket priority enum.
- `password_hash` to users.

Alembic applies this migration automatically when the backend Docker container starts.

### 6. Frontend integration

The React/Vite frontend calls the FastAPI endpoints through a shared API client. The client adds the Bearer token to protected requests and handles expired sessions. The UI supports login, dashboard metrics, ticket creation, editing, filtering, assignment, pagination, and High priority display.

### 7. Seed data

The seed script clears and recreates demo data. It creates users with password `Project` and guarantees examples for Normal, High, and Urgent tickets, including overdue, non-overdue, assigned, and unassigned cases.

## Verification Strategy

The implementation was checked with:

- Python compilation for backend modules and tests.
- Ruff backend linting.
- TypeScript checking with `npm run lint`.
- Frontend production build with `npm run build`.
- Alembic migration status.
- Live health endpoint checks.
- Live password login and protected API requests.
- A rollback-based escalation probe proving:

```text
First run:  Normal -> High
Second run: High -> Urgent
```

## Important Limitation

This document describes implementation decisions and verification evidence. It intentionally does not reproduce private hidden chain-of-thought or internal model reasoning. The relevant technical rationale and observable engineering decisions are documented above.
