"""Mandatory queue-ordering test cases.

Uses a fake, controllable clock (`app.utils.datetime.override_clock`)
rather than real time, so "overdue" can be asserted deterministically.
"""

from __future__ import annotations

from datetime import timedelta

from app.models.ticket import Priority, Status
from app.services.queue_service import QueueService
from app.utils.datetime import advance_clock
from tests.conftest import make_ticket


def test_worked_example_from_spec(db_session, fixed_now):
    """The exact example from the spec:

    now = 3:00 PM
    T1 NORMAL due 2:00 PM  -> OVERDUE
    T2 URGENT due 5:00 PM  -> NOT OVERDUE
    T3 NORMAL due 4:00 PM  -> NOT OVERDUE
    T4 URGENT due 3:30 PM  -> NOT OVERDUE

    Expected queue: T1, T4, T2, T3
    """
    base = fixed_now.replace(hour=0, minute=0)
    t1 = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=base,
        due_at=base.replace(hour=14),
        title="T1",
    )
    t2 = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=base,
        due_at=base.replace(hour=17),
        title="T2",
    )
    t3 = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=base,
        due_at=base.replace(hour=16),
        title="T3",
    )
    t4 = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=base,
        due_at=base.replace(hour=15, minute=30),
        title="T4",
    )

    tickets = [t1, t2, t3, t4]
    ordered = sorted(tickets, key=lambda t: QueueService.sort_key(t, fixed_now))

    assert [t.title for t in ordered] == ["T1", "T4", "T2", "T3"]


def test_1_overdue_normal_before_non_overdue_urgent(db_session, fixed_now):
    overdue_normal = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now - timedelta(hours=30),
        due_at=fixed_now - timedelta(hours=6),
        title="overdue-normal",
    )
    not_overdue_urgent = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=1),
        title="fresh-urgent",
    )

    ordered = sorted(
        [not_overdue_urgent, overdue_normal], key=lambda t: QueueService.sort_key(t, fixed_now)
    )
    assert [t.title for t in ordered] == ["overdue-normal", "fresh-urgent"]


def test_2_overdue_urgent_before_overdue_normal(db_session, fixed_now):
    overdue_normal = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now - timedelta(hours=30),
        due_at=fixed_now - timedelta(hours=1),
        title="overdue-normal",
    )
    overdue_urgent = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now - timedelta(hours=5),
        due_at=fixed_now - timedelta(hours=3),
        title="overdue-urgent",
    )

    ordered = sorted(
        [overdue_normal, overdue_urgent], key=lambda t: QueueService.sort_key(t, fixed_now)
    )
    assert [t.title for t in ordered] == ["overdue-urgent", "overdue-normal"]


def test_3_among_non_overdue_urgent_before_normal(db_session, fixed_now):
    normal = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=20),
        title="normal",
    )
    urgent = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=1, minutes=59),
        title="urgent",
    )

    ordered = sorted([normal, urgent], key=lambda t: QueueService.sort_key(t, fixed_now))
    assert [t.title for t in ordered] == ["urgent", "normal"]


def test_4_same_category_earlier_due_at_first(db_session, fixed_now):
    later = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=2),
        title="later-due",
    )
    earlier = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=1),
        title="earlier-due",
    )

    ordered = sorted([later, earlier], key=lambda t: QueueService.sort_key(t, fixed_now))
    assert [t.title for t in ordered] == ["earlier-due", "later-due"]


def test_5_exact_ties_are_deterministic(db_session, fixed_now):
    """Same priority, same due_at, same created_at -> lower id wins."""
    same_due = fixed_now + timedelta(hours=2)
    first = make_ticket(
        db_session, priority=Priority.URGENT, created_at=fixed_now, due_at=same_due, title="first"
    )
    second = make_ticket(
        db_session, priority=Priority.URGENT, created_at=fixed_now, due_at=same_due, title="second"
    )
    assert first.id < second.id

    ordered = sorted([second, first], key=lambda t: QueueService.sort_key(t, fixed_now))
    assert [t.id for t in ordered] == [first.id, second.id]


def test_6_resolved_ticket_not_treated_as_overdue(db_session, fixed_now):
    resolved_but_late = make_ticket(
        db_session,
        priority=Priority.URGENT,
        status=Status.RESOLVED,
        created_at=fixed_now - timedelta(hours=10),
        due_at=fixed_now - timedelta(hours=5),
        title="resolved-late",
    )
    closed_but_late = make_ticket(
        db_session,
        priority=Priority.URGENT,
        status=Status.CLOSED,
        created_at=fixed_now - timedelta(hours=10),
        due_at=fixed_now - timedelta(hours=5),
        title="closed-late",
    )
    open_and_ontime = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        status=Status.OPEN,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=5),
        title="open-ontime",
    )

    assert QueueService.is_overdue(resolved_but_late, fixed_now) is False
    assert QueueService.is_overdue(closed_but_late, fixed_now) is False

    ordered = sorted(
        [resolved_but_late, closed_but_late, open_and_ontime],
        key=lambda t: QueueService.sort_key(t, fixed_now),
    )
    # None are overdue, so plain priority/due_at ordering applies; the
    # important assertion is that neither resolved/closed ticket is
    # ranked into the "overdue" bucket (rank 0).
    for t in ordered:
        assert QueueService.sort_key(t, fixed_now)[0] == 1


def test_7_priority_change_updates_ordering(db_session, fixed_now):
    from app.repositories.ticket_repository import TicketRepository
    from app.repositories.user_repository import UserRepository
    from app.services.ticket_service import TicketService

    ticket = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=24),
        title="promote-me",
    )
    other_urgent = make_ticket(
        db_session,
        priority=Priority.URGENT,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=3),
        title="already-urgent",
    )

    # Before: normal ticket ranks after the urgent one.
    before = sorted([ticket, other_urgent], key=lambda t: QueueService.sort_key(t, fixed_now))
    assert before[0].title == "already-urgent"

    service = TicketService(TicketRepository(db_session), UserRepository(db_session))
    updated = service.update_ticket(ticket.id, priority=Priority.URGENT)

    # due_at is recalculated from the ORIGINAL created_at using the new SLA.
    assert updated.due_at == fixed_now + timedelta(hours=2)

    after = sorted([updated, other_urgent], key=lambda t: QueueService.sort_key(t, fixed_now))
    assert after[0].title == "promote-me"


def test_8_advancing_clock_changes_overdue_classification(db_session, fixed_now):
    ticket = make_ticket(
        db_session,
        priority=Priority.NORMAL,
        created_at=fixed_now,
        due_at=fixed_now + timedelta(hours=1),
        title="soon-due",
    )

    assert QueueService.is_overdue(ticket) is False

    advance_clock(timedelta(hours=2))
    assert QueueService.is_overdue(ticket) is True
