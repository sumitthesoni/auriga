"""Data access for Ticket records.

All filtering happens as SQL WHERE clauses, ordering is delegated to
`QueueService.apply_ordering` (never re-implemented here), and pagination
is applied last via LIMIT/OFFSET - so the DB always does
filter -> order -> paginate, in that order, and nothing is ever loaded
into Python just to be re-sorted or re-sliced.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.ticket import Priority, Status, Ticket
from app.services.queue_service import QueueService


@dataclass(slots=True)
class TicketFilters:
    priority: Priority | None = None
    status: Status | None = None
    overdue: bool | None = None
    assigned_to: int | None = None
    customer: str | None = None
    search: str | None = None


class TicketRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # -- internal helpers -------------------------------------------------

    def _base_select(self) -> Select:
        return select(Ticket).options(joinedload(Ticket.assignee))

    def _apply_filters(self, stmt: Select, filters: TicketFilters, now: datetime) -> Select:
        if filters.priority is not None:
            stmt = stmt.where(Ticket.priority == filters.priority)

        if filters.status is not None:
            stmt = stmt.where(Ticket.status == filters.status)

        if filters.overdue is not None:
            overdue_expr = QueueService.overdue_expression(now)
            stmt = stmt.where(overdue_expr if filters.overdue else ~overdue_expr)

        if filters.assigned_to is not None:
            stmt = stmt.where(Ticket.assigned_to == filters.assigned_to)

        if filters.customer:
            # Case-insensitive partial match on customer name.
            stmt = stmt.where(Ticket.customer_name.ilike(f"%{filters.customer.strip()}%"))

        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    Ticket.title.ilike(term),
                    Ticket.description.ilike(term),
                    Ticket.customer_name.ilike(term),
                    Ticket.customer_email.ilike(term),
                )
            )

        return stmt

    # -- public API ---------------------------------------------------------

    def list_paginated(
        self,
        filters: TicketFilters,
        page: int,
        page_size: int,
        now: datetime,
    ) -> tuple[list[Ticket], int]:
        """Return (page of tickets, total matching count).

        Ordering follows the canonical queue rule. Filtering narrows the
        candidate set first; it never changes what "most pressing first"
        means for whatever tickets remain.
        """
        base_stmt = self._apply_filters(select(Ticket.id), filters, now)

        total = self.db.execute(select(func.count()).select_from(base_stmt.subquery())).scalar_one()

        stmt = self._apply_filters(self._base_select(), filters, now)
        stmt = QueueService.apply_ordering(stmt, now)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.execute(stmt).unique().scalars().all())
        return items, total

    def get(self, ticket_id: int) -> Ticket | None:
        stmt = self._base_select().where(Ticket.id == ticket_id)
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def create(self, ticket: Ticket) -> Ticket:
        self.db.add(ticket)
        self.db.flush()
        self.db.refresh(ticket)
        return ticket

    def save(self, ticket: Ticket) -> Ticket:
        self.db.flush()
        self.db.refresh(ticket)
        return ticket

    def list_overdue_active(self, now: datetime) -> list[Ticket]:
        return list(
            self.db.execute(self._base_select().where(QueueService.overdue_expression(now)))
            .unique()
            .scalars()
            .all()
        )

    def dashboard_stats(self, now: datetime) -> dict[str, int]:
        from app.models.ticket import INACTIVE_STATUSES

        open_count = self.db.execute(
            select(func.count()).where(Ticket.status.notin_(INACTIVE_STATUSES))
        ).scalar_one()

        overdue_count = self.db.execute(
            select(func.count()).where(QueueService.overdue_expression(now))
        ).scalar_one()

        urgent_count = self.db.execute(
            select(func.count()).where(
                Ticket.priority == Priority.URGENT,
                Ticket.status.notin_(INACTIVE_STATUSES),
            )
        ).scalar_one()

        unassigned_count = self.db.execute(
            select(func.count()).where(
                Ticket.assigned_to.is_(None),
                Ticket.status.notin_(INACTIVE_STATUSES),
            )
        ).scalar_one()

        return {
            "open_tickets": open_count,
            "overdue": overdue_count,
            "urgent": urgent_count,
            "unassigned": unassigned_count,
        }
