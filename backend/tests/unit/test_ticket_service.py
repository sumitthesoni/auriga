from __future__ import annotations

from datetime import timedelta

import pytest

from app.models.ticket import Priority, Status
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.services.ticket_service import (
    TicketNotFoundError,
    TicketService,
    UserNotFoundError,
)
from app.utils.datetime import override_clock
from tests.conftest import make_ticket, make_user


@pytest.fixture
def service(db_session):
    return TicketService(TicketRepository(db_session), UserRepository(db_session))


def test_urgent_ticket_gets_2_hour_sla(service, fixed_now):
    ticket = service.create_ticket(
        customer_name="Amit Sharma",
        customer_email="amit@example.com",
        title="Laptop won't boot",
        description="before demo",
        priority=Priority.URGENT,
    )
    assert ticket.created_at == fixed_now
    assert ticket.due_at == fixed_now + timedelta(hours=2)


def test_normal_ticket_gets_24_hour_sla(service, fixed_now):
    ticket = service.create_ticket(
        customer_name="Neha",
        customer_email=None,
        title="Need bigger monitor",
        description=None,
        priority=Priority.NORMAL,
    )
    assert ticket.due_at == fixed_now + timedelta(hours=24)


def test_client_cannot_supply_due_at(service, fixed_now):
    """TicketCreate has no due_at/created_at fields at all - this test
    documents that create_ticket() only ever accepts the fields it
    computes from, proving the server is the sole source of truth."""
    import inspect

    params = inspect.signature(service.create_ticket).parameters
    assert "due_at" not in params
    assert "created_at" not in params


def test_get_missing_ticket_raises(service):
    with pytest.raises(TicketNotFoundError):
        service.get_ticket(999_999)


def test_assign_to_unknown_user_raises(service, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2))
    with pytest.raises(UserNotFoundError):
        service.assign(ticket.id, 999_999)


def test_assign_and_unassign(service, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=2))
    user = make_user(db_session, name="Priya Patel")

    assigned = service.assign(ticket.id, user.id)
    assert assigned.assigned_to == user.id

    unassigned = service.assign(ticket.id, None)
    assert unassigned.assigned_to is None


def test_update_status_only_does_not_touch_due_at(service, db_session, fixed_now):
    ticket = make_ticket(db_session, created_at=fixed_now, due_at=fixed_now + timedelta(hours=24))
    original_due_at = ticket.due_at

    updated = service.update_ticket(ticket.id, status=Status.IN_PROGRESS)
    assert updated.due_at == original_due_at
    assert updated.status == Status.IN_PROGRESS


def test_update_same_priority_does_not_recalculate_due_at(service, db_session, fixed_now):
    ticket = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=24),
    )

    # Move the clock forward, then "update" to the same priority - due_at
    # must NOT shift to be relative to the new "now".
    override_clock(fixed_now + timedelta(hours=5))
    updated = service.update_ticket(ticket.id, priority=Priority.NORMAL)
    assert updated.due_at == fixed_now + timedelta(hours=24)
