from __future__ import annotations

from datetime import timedelta

from app.models.ticket import Priority, Status
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.services.ticket_service import TicketService
from tests.conftest import make_ticket


def test_escalation_moves_one_level_per_run(db_session, fixed_now):
    service = TicketService(TicketRepository(db_session), UserRepository(db_session))
    ticket = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now - timedelta(days=2),
        due_at=fixed_now - timedelta(days=1),
    )

    assert service.escalate_overdue_tickets(fixed_now) == 1
    assert ticket.priority == Priority.HIGH
    assert service.escalate_overdue_tickets(fixed_now) == 1
    assert ticket.priority == Priority.URGENT
    assert service.escalate_overdue_tickets(fixed_now) == 0
    assert ticket.priority == Priority.URGENT


def test_escalation_skips_resolved_and_closed(db_session, fixed_now):
    service = TicketService(TicketRepository(db_session), UserRepository(db_session))
    resolved = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        status=Status.RESOLVED,
        created_at=fixed_now - timedelta(days=2),
        due_at=fixed_now - timedelta(days=1),
    )
    closed = make_ticket(
        db_session,
        priority=Priority.HIGH,
        status=Status.CLOSED,
        created_at=fixed_now - timedelta(days=2),
        due_at=fixed_now - timedelta(days=1),
    )

    assert service.escalate_overdue_tickets(fixed_now) == 0
    assert resolved.priority == Priority.NORMAL
    assert closed.priority == Priority.HIGH
