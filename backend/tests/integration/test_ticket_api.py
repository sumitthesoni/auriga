"""Integration tests exercising the HTTP API end-to-end via httpx/TestClient."""

from __future__ import annotations

from datetime import timedelta

from app.models.ticket import Priority, Status
from tests.conftest import make_ticket, make_user

# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# --------------------------------------------------------------------------
# Create / SLA
# --------------------------------------------------------------------------


def test_create_urgent_ticket_gets_2h_sla(client, fixed_now):
    resp = client.post(
        "/api/tickets",
        json={
            "customer_name": "Amit Sharma",
            "customer_email": "amit@example.com",
            "title": "Laptop won't boot",
            "description": "before client demo",
            "priority": "urgent",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["priority"] == "urgent"
    assert body["status"] == "open"
    assert body["overdue"] is False


def test_create_ticket_ignores_client_supplied_due_at(client, fixed_now):
    """Even if a client sneaks a due_at into the payload, it's ignored -
    TicketCreate has no such field, so FastAPI/Pydantic strips it."""
    resp = client.post(
        "/api/tickets",
        json={
            "customer_name": "Someone",
            "title": "Hack the deadline",
            "priority": "normal",
            "due_at": "2000-01-01T00:00:00Z",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["due_at"] != "2000-01-01T00:00:00Z"


def test_create_ticket_validation_errors(client):
    resp = client.post(
        "/api/tickets", json={"customer_name": "", "title": "x", "priority": "normal"}
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/tickets", json={"customer_name": "A", "title": "", "priority": "normal"}
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/tickets", json={"customer_name": "A", "title": "x", "priority": "not-a-priority"}
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/tickets",
        json={"customer_name": "A", "title": "x", "priority": "normal", "customer_email": "nope"},
    )
    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Get / 404
# --------------------------------------------------------------------------


def test_get_ticket_not_found_returns_404(client):
    resp = client.get("/api/tickets/999999")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Ticket not found"}


def test_get_ticket_by_id(client, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2))
    resp = client.get(f"/api/tickets/{ticket.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == ticket.id


# --------------------------------------------------------------------------
# Update / priority-change SLA recalculation
# --------------------------------------------------------------------------


def test_update_status(client, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=24))
    resp = client.patch(f"/api/tickets/{ticket.id}", json={"status": "in_progress"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


def test_update_priority_recalculates_due_at(client, db_session, fixed_now):
    ticket = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=24),
    )
    resp = client.patch(f"/api/tickets/{ticket.id}", json={"priority": "urgent"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["priority"] == "urgent"

    expected_due = (fixed_now + timedelta(hours=2)).isoformat()
    assert body["due_at"].startswith(expected_due[:19])


def test_update_missing_ticket_404(client):
    resp = client.patch("/api/tickets/999999", json={"status": "closed"})
    assert resp.status_code == 404


# --------------------------------------------------------------------------
# Assignment
# --------------------------------------------------------------------------


def test_list_users(client, db_session):
    make_user(db_session, name="Priya Patel")
    make_user(db_session, name="Amit Sharma", email="amit.agent@example.com")

    resp = client.get("/api/users")
    assert resp.status_code == 200
    names = {u["name"] for u in resp.json()}
    assert {"Priya Patel", "Amit Sharma"} <= names


def test_assign_ticket(client, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2))
    user = make_user(db_session, name="Priya Patel")

    resp = client.post(f"/api/tickets/{ticket.id}/assign", json={"user_id": user.id})
    assert resp.status_code == 200
    assert resp.json()["assigned_to"] == user.id


def test_unassign_ticket(client, db_session, fixed_now):
    user = make_user(db_session, name="Priya Patel")
    ticket = make_ticket(
        db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2), assigned_to=user.id
    )

    resp = client.post(f"/api/tickets/{ticket.id}/assign", json={"user_id": None})
    assert resp.status_code == 200
    assert resp.json()["assigned_to"] is None


def test_assign_to_unknown_user_400(client, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2))
    resp = client.post(f"/api/tickets/{ticket.id}/assign", json={"user_id": 999999})
    assert resp.status_code == 400


# --------------------------------------------------------------------------
# Queue ordering via the list endpoint
# --------------------------------------------------------------------------


def test_queue_ordering_via_api(client, db_session, fixed_now):
    base = fixed_now.replace(hour=0, minute=0, second=0, microsecond=0)
    make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=base,
        due_at=base.replace(hour=14),
        title="T1",
    )
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=base,
        due_at=base.replace(hour=17),
        title="T2",
    )
    make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=base,
        due_at=base.replace(hour=16),
        title="T3",
    )
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=base,
        due_at=base.replace(hour=15, minute=30),
        title="T4",
    )

    resp = client.get("/api/tickets")
    assert resp.status_code == 200
    body = resp.json()
    assert [t["title"] for t in body["items"]] == ["T1", "T4", "T2", "T3"]
    assert body["items"][0]["overdue"] is True


# --------------------------------------------------------------------------
# Filters
# --------------------------------------------------------------------------


def test_filter_overdue_true(client, db_session, fixed_now):
    make_ticket(
        db_session,
        created_at=fixed_now - timedelta(hours=30),
        due_at=fixed_now - timedelta(hours=2),
        title="late",
    )
    make_ticket(
        db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2), title="ontime"
    )

    resp = client.get("/api/tickets?overdue=true")
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["late"]


def test_filter_priority(client, db_session, fixed_now):
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="u",
    )
    make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=24),
        title="n",
    )

    resp = client.get("/api/tickets?priority=urgent")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["u"]


def test_filter_status(client, db_session, fixed_now):
    make_ticket(
        db_session,
        status=Status.OPEN,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="open-t",
    )
    make_ticket(
        db_session,
        status=Status.CLOSED,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="closed-t",
    )

    resp = client.get("/api/tickets?status=closed")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["closed-t"]


def test_filter_assigned_to(client, db_session, fixed_now):
    agent = make_user(db_session, name="Priya Patel")
    make_ticket(
        db_session,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        assigned_to=agent.id,
        title="mine",
    )
    make_ticket(
        db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2), title="unassigned"
    )

    resp = client.get(f"/api/tickets?assigned_to={agent.id}")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["mine"]


def test_filter_customer_case_insensitive_partial(client, db_session, fixed_now):
    make_ticket(
        db_session,
        customer_name="Amit Sharma",
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="a",
    )
    make_ticket(
        db_session,
        customer_name="Neha Gupta",
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="b",
    )

    for query in ("Amit", "amit", "AMIT", "Amit Sharma"):
        resp = client.get(f"/api/tickets?customer={query}")
        titles = [t["title"] for t in resp.json()["items"]]
        assert titles == ["a"], f"query={query!r} failed"


def test_general_search(client, db_session, fixed_now):
    make_ticket(
        db_session,
        title="Laptop won't boot",
        description="urgent hardware issue",
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
    )
    make_ticket(
        db_session,
        title="VPN not working",
        description="network issue",
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
    )

    resp = client.get("/api/tickets?search=laptop")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["Laptop won't boot"]


def test_combined_filters(client, db_session, fixed_now):
    agent = make_user(db_session, name="Priya Patel")
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now - timedelta(hours=5),
        due_at=fixed_now - timedelta(hours=1),
        assigned_to=agent.id,
        title="match",
    )
    make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now - timedelta(hours=5),
        due_at=fixed_now - timedelta(hours=1),
        assigned_to=agent.id,
        title="wrong-priority",
    )
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        assigned_to=agent.id,
        title="not-overdue",
    )

    resp = client.get(f"/api/tickets?overdue=true&assigned_to={agent.id}&priority=urgent")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["match"]


def test_filters_never_break_ordering(client, db_session, fixed_now):
    """Filtered results still follow the canonical queue order among
    themselves (overdue-first, urgent-before-normal, due_at asc)."""
    base = fixed_now
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        status=Status.OPEN,
        created_at=base,
        due_at=base + timedelta(hours=5),
        title="later",
    )
    make_ticket(
        db_session,
        priority=Priority.URGENT,
        status=Status.OPEN,
        created_at=base,
        due_at=base + timedelta(hours=1),
        title="earlier",
    )

    resp = client.get("/api/tickets?status=open")
    titles = [t["title"] for t in resp.json()["items"]]
    assert titles == ["earlier", "later"]


def test_empty_result_when_no_tickets(client):
    resp = client.get("/api/tickets")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["total_pages"] == 0


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------


def _seed_many(db_session, fixed_now, count: int):
    for i in range(count):
        make_ticket(
            db_session,
            created_at=fixed_now,
            due_at=fixed_now + timedelta(hours=i + 1),
            title=f"ticket-{i:03d}",
        )


def test_pagination_basic(client, db_session, fixed_now):
    _seed_many(db_session, fixed_now, 45)

    resp1 = client.get("/api/tickets?page=1&page_size=20")
    body1 = resp1.json()
    assert len(body1["items"]) == 20
    assert body1["total"] == 45
    assert body1["total_pages"] == 3
    assert body1["page"] == 1

    resp2 = client.get("/api/tickets?page=2&page_size=20")
    body2 = resp2.json()
    assert len(body2["items"]) == 20

    resp3 = client.get("/api/tickets?page=3&page_size=20")
    body3 = resp3.json()
    assert len(body3["items"]) == 5

    ids_1 = {t["id"] for t in body1["items"]}
    ids_2 = {t["id"] for t in body2["items"]}
    ids_3 = {t["id"] for t in body3["items"]}
    assert ids_1.isdisjoint(ids_2)
    assert ids_1.isdisjoint(ids_3)
    assert ids_2.isdisjoint(ids_3)
    assert len(ids_1 | ids_2 | ids_3) == 45


def test_pagination_stable_ordering_across_pages(client, db_session, fixed_now):
    _seed_many(db_session, fixed_now, 25)

    all_ids = []
    for page in (1, 2):
        resp = client.get(f"/api/tickets?page={page}&page_size=20")
        all_ids.extend(t["id"] for t in resp.json()["items"])

    assert all_ids == sorted(all_ids, key=lambda i: i)


def test_pagination_default_page_size(client, db_session, fixed_now):
    _seed_many(db_session, fixed_now, 25)
    resp = client.get("/api/tickets")
    body = resp.json()
    assert body["page_size"] == 20
    assert body["page"] == 1
    assert len(body["items"]) == 20


def test_pagination_invalid_page_rejected(client):
    resp = client.get("/api/tickets?page=0")
    assert resp.status_code == 422

    resp = client.get("/api/tickets?page=-1")
    assert resp.status_code == 422


def test_pagination_max_page_size_enforced(client):
    resp = client.get("/api/tickets?page_size=101")
    assert resp.status_code == 422

    resp = client.get("/api/tickets?page_size=100")
    assert resp.status_code == 200


def test_pagination_beyond_last_page_returns_empty(client, db_session, fixed_now):
    _seed_many(db_session, fixed_now, 5)
    resp = client.get("/api/tickets?page=99&page_size=20")
    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 5


# --------------------------------------------------------------------------
# Dashboard stats
# --------------------------------------------------------------------------


def test_dashboard_stats(client, db_session, fixed_now):
    agent = make_user(db_session, name="Priya Patel")
    make_ticket(
        db_session,
        status=Status.OPEN,
        priority=Priority.URGENT,
        created_at=fixed_now - timedelta(hours=5),
        due_at=fixed_now - timedelta(hours=1),
        title="overdue-urgent-unassigned",
    )
    make_ticket(
        db_session,
        status=Status.OPEN,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=24),
        assigned_to=agent.id,
        title="normal-assigned",
    )
    make_ticket(
        db_session,
        status=Status.CLOSED,
        priority=Priority.URGENT,
        created_at=fixed_now - timedelta(hours=40),
        due_at=fixed_now - timedelta(hours=30),
        title="closed-old",
    )

    resp = client.get("/api/tickets/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["open_tickets"] == 2  # closed one excluded
    assert stats["overdue"] == 1
    assert stats["urgent"] == 1  # closed urgent excluded from active urgent count
    assert stats["unassigned"] == 1
