PROMPT : 
# Build Round Project: Generic Helpdesk Ticket Management System

You are a senior full-stack engineer. Build a complete, production-style **Helpdesk Ticket Management System** based on the requirements below.

The central requirement is the **ticket queue ordering rule**. Correct queue ordering is more important than adding excessive features. Build the system generically so it works for any helpdesk, not specifically for Priya.

Do not merely generate a demo or mock UI. Build a working application with backend, database, frontend, validation, tests, documentation, seed data, and Docker setup.

---

# 1. Problem Statement

A small IT helpdesk receives a large number of support tickets.

Examples:

* "My laptop won't boot before a client demo."
* "VPN is not working."
* "Can I get a bigger monitor?"
* "Please install software X."

Each ticket has:

* a priority
* a creation time
* an agreed response deadline
* a status
* an optional assignee
* a customer

Urgent tickets must receive a response within **2 hours**.

Normal tickets must receive a response within **24 hours**.

The helpdesk staff needs a queue that automatically places the **most pressing ticket at the top**.

A ticket whose response deadline has already passed must jump ahead of tickets that are still within their promised response time.

The system must also allow staff to:

* see overdue tickets
* see tickets assigned to a particular employee
* find a customer's tickets by name
* paginate through a very large ticket list

The queue ordering is the heart of the system.

---

# 2. Core Business Rule

Implement the queue ordering as a centralized, reusable business rule.

Do NOT scatter ticket-priority logic throughout controllers/routes.

The queue should conceptually follow:

```text
1. Overdue tickets first
2. Within the same overdue category:
      urgent before normal
3. Earlier due time before later due time
4. Older creation time first as a deterministic tie-breaker
5. Ticket ID as the final deterministic tie-breaker
```

For example, if the current time is 3:00 PM:

```text
T1 → NORMAL → due 2:00 PM → OVERDUE
T2 → URGENT → due 5:00 PM → NOT OVERDUE
T3 → NORMAL → due 4:00 PM → NOT OVERDUE
T4 → URGENT → due 3:30 PM → NOT OVERDUE
```

Queue:

```text
T1
T4
T2
T3
```

The exact queue semantics must be represented explicitly in code and covered by automated tests.

Create a dedicated queue/ordering service or equivalent abstraction.

---

# 3. Important Deadline Rule

When a ticket is created:

```text
URGENT → due_at = created_at + 2 hours
NORMAL → due_at = created_at + 24 hours
```

The server must calculate the deadline.

Do not trust the client to submit the deadline for normal ticket creation.

Allow the system to calculate:

```text
created_at
due_at
```

from:

```text
priority
```

Use timezone-aware UTC timestamps internally.

Display dates/times appropriately in the frontend.

---

# 4. Overdue Calculation

Do not permanently store `is_overdue` as the source of truth.

Overdue status should be derived from:

```text
due_at < current_time
```

and the ticket's lifecycle status.

A resolved/closed ticket should not remain in the active helpdesk queue merely because its original deadline has passed.

Expose a computed:

```text
overdue: true/false
```

in API responses.

Use the database/query layer wherever practical so that overdue filtering and queue ordering remain efficient for large datasets.

---

# 5. Suggested Technology Stack

Use this stack unless there is a strong technical reason to change it.

## Backend

* Python 3.12+
* FastAPI
* SQLAlchemy 2.x
* PostgreSQL
* Pydantic v2
* Alembic
* pytest
* httpx for API testing

## Frontend

* React
* TypeScript
* Vite
* TanStack Query
* React Router
* modern CSS or Tailwind CSS

## Infrastructure

* Docker
* Docker Compose

Do not introduce unnecessary microservices.

Use a clean modular monolith architecture.

---

# 6. High-Level Architecture

Use this architecture:

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    └──────────┬──────────┘
                               │ HTTP/JSON
                               ▼
                    ┌─────────────────────┐
                    │      FastAPI        │
                    │      API Layer      │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Service Layer     │
                    │                     │
                    │ Ticket Service      │
                    │ Queue Service       │
                    │ Assignment Service  │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Repository / ORM    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    └─────────────────────┘
```

Keep responsibilities separated.

---

# 7. Project Structure

Create a clean repository like:

```text
helpdesk-ticket-system/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── tickets.py
│   │   │   │   ├── users.py
│   │   │   │   └── health.py
│   │   │   └── dependencies.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   ├── ticket.py
│   │   │   └── user.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── ticket.py
│   │   │   └── user.py
│   │   │
│   │   ├── repositories/
│   │   │   ├── ticket_repository.py
│   │   │   └── user_repository.py
│   │   │
│   │   ├── services/
│   │   │   ├── ticket_service.py
│   │   │   ├── queue_service.py
│   │   │   └── assignment_service.py
│   │   │
│   │   └── utils/
│   │       └── datetime.py
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_queue_order.py
│   │   │   └── test_ticket_service.py
│   │   └── integration/
│   │       └── test_ticket_api.py
│   │
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── README.md
└── Makefile
```

You may improve the structure as long as the separation of concerns remains clear.

---

# 8. Database Design

Create at minimum:

## Users table

```text
users
-----
id
name
email
created_at
```

Users represent helpdesk employees who can be assigned tickets.

## Tickets table

```text
tickets
-------
id
customer_name
customer_email
title
description
priority
status
created_at
due_at
assigned_to
updated_at
```

Use proper PostgreSQL types.

Suggested enums:

```text
Priority:
    urgent
    normal

Status:
    open
    in_progress
    resolved
    closed
```

`assigned_to` should reference `users.id`.

Add foreign-key constraints.

Add appropriate indexes for:

```text
due_at
priority
status
assigned_to
customer_name
created_at
```

Consider composite indexes that improve the common queue/filter queries.

---

# 9. API Endpoints

Implement REST APIs.

## Health

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

---

## Create ticket

```http
POST /api/tickets
```

Request:

```json
{
  "customer_name": "Amit Sharma",
  "customer_email": "amit@example.com",
  "title": "Laptop won't boot",
  "description": "Laptop is not starting before client demo",
  "priority": "urgent"
}
```

Server calculates:

```text
created_at
due_at
```

Do not let normal clients arbitrarily choose these values.

---

## Get ticket by ID

```http
GET /api/tickets/{ticket_id}
```

---

## Update ticket

```http
PATCH /api/tickets/{ticket_id}
```

Allow appropriate fields such as:

```text
status
priority
assigned_to
title
description
```

Be careful when priority changes.

If priority changes and the business rule says the SLA changes accordingly, recalculate `due_at` according to the documented rule. Document the chosen behavior.

Do not silently produce inconsistent SLA data.

---

# 10. Main Queue Endpoint

Implement:

```http
GET /api/tickets
```

Supported query parameters:

```text
page
page_size
priority
status
overdue
assigned_to
customer
search
```

Example:

```http
GET /api/tickets?page=1&page_size=20
```

Example:

```http
GET /api/tickets?overdue=true
```

Example:

```http
GET /api/tickets?assigned_to=3
```

Example:

```http
GET /api/tickets?customer=Amit
```

Example:

```http
GET /api/tickets?priority=urgent&status=open
```

Example:

```http
GET /api/tickets?search=laptop
```

All results must use the central queue ordering rule unless an explicit alternative sort is later added.

---

# 11. Pagination

Implement server-side pagination.

Default:

```text
page = 1
page_size = 20
```

Maximum:

```text
page_size <= 100
```

Response:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 153,
  "total_pages": 8
}
```

Important:

Pagination must happen **after the database applies the correct global ordering**.

Do not:

```text
load all tickets
sort in frontend
paginate in frontend
```

Do:

```text
database filtering
        ↓
database ordering
        ↓
database pagination
        ↓
API response
```

---

# 12. Assignment APIs

Implement:

```http
GET /api/users
```

and:

```http
POST /api/tickets/{ticket_id}/assign
```

Request:

```json
{
  "user_id": 3
}
```

Also allow unassignment where appropriate.

The frontend should provide an assignee selector.

---

# 13. Customer Search

Support lookup by customer name.

Example:

```http
GET /api/tickets?customer=Amit
```

Prefer case-insensitive matching.

Support partial matching where practical.

For PostgreSQL, choose a sensible indexing/search strategy.

For example:

```text
Amit
amit
AMIT
Amit Sharma
```

should behave sensibly.

---

# 14. Search

Add a general search parameter:

```http
GET /api/tickets?search=laptop
```

Search at least:

```text
title
description
customer_name
customer_email
```

Do not make search destroy the queue ordering.

Search should filter the candidate set and then the same queue rule should order the results.

---

# 15. Frontend Requirements

Build a professional dashboard.

Main page:

```text
---------------------------------------------------------
Helpdesk
---------------------------------------------------------

[ Search tickets... ]

[ Priority ] [ Status ] [ Overdue ] [ Assignee ]

---------------------------------------------------------
Queue
---------------------------------------------------------

OVERDUE   URGENT
Laptop won't boot
Amit Sharma
Due: 12:00 PM
Assigned: Priya

---------------------------------------------------------

URGENT
VPN not working
Rahul
Due: 4:30 PM
Assigned: Amit

---------------------------------------------------------

NORMAL
Need bigger monitor
Neha
Due: Tomorrow 11:00 AM
Unassigned
---------------------------------------------------------

          < Previous   1 2 3 4   Next >
```

The UI should make overdue tickets visually obvious.

Show:

```text
priority
status
customer
title
assignee
created time
due time
overdue state
```

Do not rely solely on color.

Use labels/icons/text for accessibility.

---

# 16. Dashboard Statistics

Add useful summary cards:

```text
Open Tickets
Overdue
Urgent
Unassigned
```

For example:

```text
┌─────────────┐ ┌─────────────┐
│ Open   153  │ │ Overdue 18  │
└─────────────┘ └─────────────┘

┌─────────────┐ ┌─────────────┐
│ Urgent  27  │ │ Unassigned 9│
└─────────────┘ └─────────────┘
```

Statistics should come from backend APIs/database queries rather than being hard-coded.

---

# 17. Ticket Detail View

Clicking a ticket should open a detail page or side panel containing:

```text
Customer
Email
Title
Description
Priority
Status
Created At
Due At
Overdue
Assigned To
Updated At
```

Allow the helpdesk employee to:

```text
change status
change priority
assign employee
unassign employee
```

Show confirmation/error feedback.

---

# 18. Create Ticket UI

Provide a form with:

```text
Customer name
Customer email
Title
Description
Priority
```

When selecting:

```text
URGENT
```

show:

```text
Response due within 2 hours
```

When selecting:

```text
NORMAL
```

show:

```text
Response due within 24 hours
```

The frontend should not calculate the authoritative deadline.

The backend remains the source of truth.

---

# 19. Queue Logic Implementation

Create a central function/service such as:

```python
def build_queue_order(...)
```

or:

```python
class QueueService:
    ...
```

The queue logic should be reusable from:

```text
GET /tickets
GET /tickets?overdue=true
GET /tickets?assigned_to=...
GET /tickets?customer=...
```

Do not duplicate ordering logic across endpoints.

The database query should ideally express the ordering efficiently.

For example, conceptually:

```sql
ORDER BY
    CASE
        WHEN due_at < CURRENT_TIMESTAMP
             AND status NOT IN ('resolved', 'closed')
        THEN 0
        ELSE 1
    END,
    CASE
        WHEN priority = 'urgent' THEN 0
        ELSE 1
    END,
    due_at ASC,
    created_at ASC,
    id ASC
```

Adapt the SQL to the actual SQLAlchemy implementation.

Do not blindly copy this if another design is cleaner; preserve the semantics.

---

# 20. Critical Test Cases

Write extensive tests.

These are mandatory.

## Queue tests

### Test 1

Overdue normal ticket appears before non-overdue urgent ticket.

```text
NORMAL + overdue
>
URGENT + not overdue
```

### Test 2

Overdue urgent appears before overdue normal if priority is used as the secondary ordering criterion.

### Test 3

Among non-overdue tickets:

```text
urgent > normal
```

### Test 4

For same priority/status category:

```text
earlier due_at > later due_at
```

### Test 5

Exact ties use deterministic ordering.

### Test 6

Resolved/closed tickets do not incorrectly appear as active overdue queue items.

### Test 7

Changing a ticket from normal to urgent updates its ordering appropriately.

### Test 8

Advancing the clock past `due_at` changes its overdue classification.

Use a controllable/fake clock in unit tests rather than relying on real time.

---

# 21. Filter Tests

Test:

```text
overdue=true
```

Test:

```text
assigned_to=...
```

Test:

```text
priority=urgent
```

Test:

```text
status=open
```

Test:

```text
customer=...
```

Test combined filters:

```text
overdue=true
assigned_to=3
priority=urgent
```

Make sure filtering never breaks the queue ordering.

---

# 22. Pagination Tests

Test:

```text
page 1
page 2
page 3
```

Check:

* no duplicates
* no missing records
* stable ordering
* correct total
* correct total_pages
* page size enforcement
* invalid page values
* maximum page size

Also verify that pagination occurs over the **globally ordered result set**.

---

# 23. Validation

Add proper validation.

Examples:

```text
customer_name cannot be empty
title cannot be empty
priority must be urgent/normal
status must be valid
page >= 1
page_size between 1 and 100
email must have valid format when supplied
```

Return proper HTTP errors:

```text
400
404
422
```

as appropriate.

---

# 24. Error Handling

Create consistent API errors.

Example:

```json
{
  "detail": "Ticket not found"
}
```

Do not expose database stack traces to clients.

Log server-side exceptions properly.

---

# 25. Database Migrations

Use Alembic.

Create:

```text
initial migration
```

including:

```text
users
tickets
indexes
foreign keys
enums
```

The application should be able to create the database schema through migrations.

Do not depend on manual database setup.

---

# 26. Seed Data

Create a seed script.

Generate realistic sample data such as:

```text
10 helpdesk employees
500 tickets
```

Include cases such as:

```text
overdue urgent
overdue normal
non-overdue urgent
non-overdue normal
assigned
unassigned
resolved
closed
different customers
```

This is important because the queue must be tested with meaningful data.

Create enough data to demonstrate pagination.

---

# 27. Docker

Create Dockerfiles for:

```text
backend
frontend
```

and a:

```text
docker-compose.yml
```

with at least:

```text
frontend
backend
postgres
```

Expected startup:

```bash
docker compose up --build
```

The application should become usable without complicated manual setup.

---

# 28. Environment Variables

Create:

```text
.env.example
```

Example:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/helpdesk
API_PORT=8000
FRONTEND_PORT=5173
```

Do not commit real secrets.

---

# 29. API Documentation

FastAPI's automatic Swagger/OpenAPI documentation should work.

Make sure:

```text
/docs
/redoc
```

are usable.

Add meaningful endpoint descriptions and response schemas.

---

# 30. README

Write a high-quality README containing:

## Project overview

Explain the problem in simple terms.

## Architecture

Explain:

```text
Frontend
API
Services
Database
Queue ordering
```

## Queue ordering

Clearly document the exact ordering rule.

This is the most important section.

## Setup

Explain:

```bash
git clone ...
cd ...
docker compose up --build
```

## Local backend development

Include commands.

## Local frontend development

Include commands.

## Database migrations

Show Alembic commands.

## Seed data

Show seed command.

## Testing

Show:

```bash
pytest
```

## API examples

Give `curl` examples.

## Design decisions

Explain why the queue ordering lives in one centralized service/query.

---

# 31. Performance Requirements

The ticket list may contain a very large number of records.

Avoid designs that require:

```text
fetch all tickets
sort in Python
then paginate
```

Prefer:

```text
filter in database
order in database
paginate in database
```

Create appropriate indexes.

Do not prematurely introduce Redis, Kafka, Celery, Elasticsearch, or microservices unless actually required.

Keep the system simple and scalable.

---

# 32. Important Design Principle

The system should be:

```text
Generic
Reusable
Testable
Maintainable
Database-driven
```

Do not hard-code:

```text
Priya
Rahul
specific company names
specific customers
```

Use users and tickets stored in the database.

---

# 33. UX Details

Make the application feel like a real helpdesk product.

Include:

```text
loading states
empty states
error states
pagination controls
filter reset
search debounce
responsive layout
keyboard-friendly controls
accessible labels
```

When no tickets exist:

```text
No tickets found.
```

When filters return nothing:

```text
No tickets match the selected filters.
```

Make overdue status immediately understandable.

Example:

```text
OVERDUE BY 2H 15M
```

For tickets that are approaching their deadline, optionally display:

```text
Due in 35m
Due in 3h
Due tomorrow
```

Do not alter the authoritative queue logic in the frontend.

---

# 34. State Management

Use TanStack Query for server state.

The frontend should invalidate/refetch ticket queries after:

```text
creating ticket
updating ticket
assigning ticket
changing status
changing priority
```

Filters and pagination should be reflected in the URL where practical.

Example:

```text
/tickets?page=2&priority=urgent&overdue=true
```

This makes the UI shareable and preserves state on refresh.

---

# 35. Code Quality Requirements

Use:

* type hints
* clear function names
* meaningful variable names
* small focused functions
* Pydantic schemas
* service/repository separation
* comments only where they explain non-obvious logic

Avoid:

* giant files
* duplicated business rules
* unnecessary abstractions
* hard-coded values
* global mutable state
* frontend-only filtering of server datasets

Use formatting/linting where practical:

```text
ruff
black
```

for Python, and appropriate TypeScript linting for frontend.

---

# 36. Security Basics

This is not primarily an authentication challenge, but implement basic production hygiene.

At minimum:

* validate input
* parameterized database queries through SQLAlchemy
* never expose database credentials
* do not commit secrets
* restrict CORS appropriately through configuration
* avoid returning sensitive internal exception details

Do not build fake authentication just for appearance.

---

# 37. Deliverables

At the end, produce:

```text
1. Working backend
2. Working frontend
3. PostgreSQL integration
4. Alembic migrations
5. Seed data
6. Queue ordering implementation
7. Filters
8. Assignment
9. Customer search
10. Pagination
11. Automated tests
12. Docker setup
13. README
14. .env.example
```

The application should work from a clean checkout.

---

# 38. Development Strategy

Build incrementally in this order:

### Step 1

Create project skeleton.

### Step 2

Set up PostgreSQL + SQLAlchemy + Alembic.

### Step 3

Implement User and Ticket models.

### Step 4

Implement ticket creation and deadline calculation.

### Step 5

Implement queue ordering.

STOP and test the queue thoroughly before continuing.

### Step 6

Implement ticket listing + server-side pagination.

### Step 7

Implement overdue filter.

### Step 8

Implement assignment.

### Step 9

Implement customer search and general search.

### Step 10

Build frontend queue dashboard.

### Step 11

Build ticket detail/create/edit UI.

### Step 12

Add dashboard statistics.

### Step 13

Add integration tests.

### Step 14

Add Docker and seed data.

### Step 15

Run the entire system from a clean environment.

---

# 39. Acceptance Criteria

The project is considered complete only when all of the following are true:

## Queue

A ticket that becomes overdue automatically moves ahead of non-overdue tickets without requiring manual database updates.

## Priority

Urgent tickets are ordered ahead of normal tickets within the appropriate queue category.

## SLA

Urgent tickets get a 2-hour deadline.

Normal tickets get a 24-hour deadline.

## Filters

Users can filter overdue, priority, status, assignee, and customer.

## Assignment

Tickets can be assigned and filtered by assignee.

## Search

Customer and ticket information can be searched.

## Pagination

Large datasets are paginated server-side.

## Consistent ordering

Filtering and pagination do not accidentally change the underlying queue ordering.

## Testing

Queue edge cases have automated tests.

## Deployment

The full system starts with:

```bash
docker compose up --build
```

## Documentation

README explains setup, architecture, API, queue ordering, and tests.

---

# 40. Final Implementation Instruction

Do not stop after generating the initial files.

Actually implement the project end-to-end.

After implementation:

1. Run backend tests.
2. Run frontend checks/build.
3. Run database migrations.
4. Seed the database.
5. Start the full application.
6. Exercise the main APIs.
7. Verify queue ordering with realistic data.
8. Fix errors found during execution.
9. Ensure the final code is internally consistent.
10. Provide a concise final report containing:

* architecture
* important files
* queue-ordering explanation
* API endpoints
* test results
* how to run the project

Most importantly, prioritize **correct queue behavior over cosmetic features**.

The central product requirement is:

> **Always keep the most pressing helpdesk ticket at the top, with overdue tickets jumping to the front.**

Build the system around that principle.




------------------------------------------------------------------------------------------------------------

# AI Conversation Log

> This file records the visible project-related conversation and decisions made with the AI assistant. It does not include private system instructions, tool-internal metadata, or hidden chain-of-thought.

## Conversation

### User
Run this project.

### Assistant
The project was started with Docker Compose. The initial attempt failed because Docker Desktop's Linux engine was unavailable.

### User
How do I add data and check the project?

### Assistant
Explained the seed script, API endpoints, Swagger documentation, and how to add tickets with Postman.

### User
What are the APIs of this project?

### Assistant
Listed the health, authentication, users, ticket queue, ticket creation, ticket update, assignment, ticket details, and dashboard statistics endpoints.

### User
not working in my browser: `http://localhost:8000/health`?

### Assistant
Checked the route registration and explained that the correct health URL is `/api/health`, because the health router is mounted with the `/api` prefix.

### User
How do I create a ticket using Postman?

### Assistant
Provided the Postman request for `POST /api/tickets`, including the JSON body and valid priority values.

### User
I want to add 100 tickets at once.

### Assistant
Explained that the API creates one ticket per request and recommended the Postman Runner or the seed function with `seed(100)`.

### User
call the seed script?

### Assistant
Provided local and Docker commands for running `python -m app.seed` and for calling `seed(100)`.

### User
Now create an interactive frontend for the same project.

### Assistant
Inspected the backend API and began setting up a React/Vite frontend. The frontend was later added under `frontend/` with login, dashboard, ticket queue, ticket details, filtering, assignment, and API integration.

### User
Look at the project and confirm whether an access Bearer token is used for authorization.

### Assistant
Inspected the backend and confirmed that bearer-token authorization was not present at that stage.

### User
Use it in the essential locations.

### Assistant
Explained that the central dependency/authentication location should be `backend/app/api/dependencies.py`, with a current-user dependency used by protected routes.

### User
Write the Bearer-token and access-token code in the backend repository.

### Assistant
Added JWT Bearer authentication, a login route, protected ticket/user routes, JWT configuration, and the PyJWT dependency. Login returned an access token for use with `Authorization: Bearer <token>`.

### User
run docker

### Assistant
Started Docker Compose. PostgreSQL and the FastAPI backend built and became healthy. The health endpoint returned `{"status":"ok"}`.

### User
Create a detailed prompt for the frontend of the same project with all necessary internal details.

### Assistant
Created a detailed frontend implementation prompt covering the API contract, authentication, ticket operations, dashboard, queue ordering, assignment, responsive UI, validation, and startup instructions.

### User
The Twist is the automated escalation mechanism...

### Assistant
Implemented the Twist as a backend business rule. Added High priority, High SLA configuration, overdue escalation logic, a periodic escalation loop, queue ordering support, a migration, tests, and frontend updates.

### User
run the frontend?

### Assistant
Provided the commands to run the frontend with `npm install` and `npm run dev`, and the URL `http://localhost:3000`.

### User
The Twist is the automated escalation mechanism. Also add High-priority ticket changes, update the complete code, and make the login ask for a password. The password is `Project`.

### Assistant
Updated the complete project:

- Added Normal, High, and Urgent priorities.
- Added 24-hour, 8-hour, and 2-hour SLAs.
- Added password-based login using the demo password `Project`.
- Added password hashing and a database migration.
- Added the periodic one-level escalation loop.
- Added High priority to frontend forms, filters, badges, and simulator logic.
- Updated seed data and tests.

### User
Run the frontend.

### Assistant
Started Vite successfully at `http://localhost:3000`.

### User
It should not log in automatically. I will click the Login button.

### Assistant
Changed the frontend authentication behavior so the user must explicitly click Sign In rather than automatically restoring a stored session.

### User
Add High-priority data as well.

### Assistant
Updated `backend/app/seed.py` to guarantee High-priority tickets in overdue and non-overdue states, with assigned and unassigned examples.

### User
Modify and recreate the README accordingly for the complete project.

### Assistant
Recreated `README.md` with current project documentation covering Docker, frontend startup, authentication, High priority, seeding, APIs, migrations, and automatic escalation.

### User
Now run the frontend and backend from the beginning.

### Assistant
Started both services successfully:

- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/api/health`
- Swagger: `http://localhost:8000/docs`
- Frontend: `http://localhost:3000`

### User
What is an SLA?

### Assistant
Explained that SLA means Service Level Agreement and described the 24-hour Normal, 8-hour High, and 2-hour Urgent deadlines.

### User
When does High priority occur?

### Assistant
Explained that High occurs when a ticket is created as High or when an overdue Normal ticket is escalated once. A later overdue run can move High to Urgent.

### User
Create a summary of what we have discussed so far about this project.

### Assistant
Summarized the full-stack architecture, authentication, priorities, SLAs, escalation, API endpoints, seed data, and startup commands.

### User
Create `REASONING.md` as an explanation of the solution's reasoning.
Create `AI_LOGS.md` as a complete copy of the candidate's conversation with the AI tool. Also add a note that I used ChatGPT to generate the frontend prompt.

### Assistant
Created this `AI_LOGS.md` and `REASONING.md`. The frontend prompt was generated with assistance from ChatGPT, as requested. The technical reasoning document records implementation rationale without exposing private hidden chain-of-thought.

## ChatGPT Prompt Generation Note

The frontend-generation prompt used during this project was generated with assistance from ChatGPT. It described the existing FastAPI contract, authentication flow, ticket schemas, UI screens, queue ordering, SLA behavior, escalation requirements, and local development commands.
