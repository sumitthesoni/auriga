"""The single source of truth for helpdesk queue ordering.

Every endpoint that returns a list of tickets - the main queue, the
overdue filter, the assignee filter, customer/general search - MUST route
through `QueueService.apply_ordering()` (and, for the overdue flag,
`QueueService.overdue_expression()` / `QueueService.is_overdue()`) rather
than re-implementing sort logic locally. This is what keeps "the most
pressing ticket at the top" true everywhere, not just on one screen.

Ordering rule (see README for the full rationale):

    1. Overdue tickets before non-overdue tickets
    2. Within the same overdue-ness: urgent before high before normal
    3. Earlier due_at before later due_at
    4. Older created_at before newer created_at (deterministic tie-break)
    5. Lower id before higher id (final deterministic tie-break)

"Overdue" is derived, never stored: a ticket is overdue when
`due_at < now` AND its status is not resolved/closed.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, case
from sqlalchemy.sql.elements import ColumnElement

from app.models.ticket import INACTIVE_STATUSES, Priority, Ticket
from app.utils.datetime import ensure_utc, utc_now


class QueueService:
    """Centralized, reusable ticket queue ordering."""

    @staticmethod
    def overdue_expression(now: datetime | None = None) -> ColumnElement[bool]:
        """SQL boolean expression: True when a ticket is overdue.

        A ticket is overdue when its due_at has passed AND it is still in
        an active (non-resolved/non-closed) status. Resolved/closed
        tickets never count as overdue, no matter how old their due_at is.
        """
        reference_time = ensure_utc(now) if now else utc_now()
        return (Ticket.due_at < reference_time) & (Ticket.status.notin_(INACTIVE_STATUSES))

    @staticmethod
    def is_overdue(ticket: Ticket, now: datetime | None = None) -> bool:
        """Python-side equivalent of `overdue_expression`, for single objects."""
        reference_time = ensure_utc(now) if now else utc_now()
        return ensure_utc(ticket.due_at) < reference_time and ticket.status not in INACTIVE_STATUSES

    @classmethod
    def apply_ordering(cls, stmt: Select, now: datetime | None = None) -> Select:
        """Apply the canonical queue ORDER BY clause to a SELECT statement.

        This is deliberately the *only* place ORDER BY for tickets is
        constructed. Any endpoint listing tickets - queue, overdue filter,
        assignee filter, customer/general search - should build its
        WHERE clause independently and then call this to sort the result,
        so filtering never changes what "most pressing first" means.
        """
        reference_time = ensure_utc(now) if now else utc_now()
        overdue_rank = case((cls.overdue_expression(reference_time), 0), else_=1)
        priority_rank = case(
            (Ticket.priority == Priority.URGENT, 0),
            (Ticket.priority == Priority.HIGH, 1),
            else_=2,
        )

        return stmt.order_by(
            overdue_rank.asc(),
            priority_rank.asc(),
            Ticket.due_at.asc(),
            Ticket.created_at.asc(),
            Ticket.id.asc(),
        )

    @classmethod
    def sort_key(cls, ticket: Ticket, now: datetime | None = None):
        """In-memory equivalent of the ORDER BY, for unit tests / plain lists.

        Returns a tuple usable with `sorted()` that reproduces exactly the
        same ordering as `apply_ordering` produces at the database level.
        """
        reference_time = ensure_utc(now) if now else utc_now()
        overdue_rank = 0 if cls.is_overdue(ticket, reference_time) else 1
        priority_rank = {
            Priority.URGENT: 0,
            Priority.HIGH: 1,
            Priority.NORMAL: 2,
        }[ticket.priority]
        return (
            overdue_rank,
            priority_rank,
            ensure_utc(ticket.due_at),
            ensure_utc(ticket.created_at),
            ticket.id,
        )
