"""Ticket business logic: SLA/deadline calculation and create/update rules.

This is where the "server calculates due_at, never trust the client" rule
and the "priority change recalculates the SLA" rule live - centralized,
so no route handler duplicates them.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.config import Settings, get_settings
from app.models.ticket import Priority, Status, Ticket
from app.repositories.ticket_repository import TicketFilters, TicketRepository
from app.repositories.user_repository import UserRepository
from app.services.queue_service import QueueService
from app.utils.datetime import utc_now


class TicketNotFoundError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class InvalidAssignmentError(Exception):
    pass


@dataclass(slots=True)
class PaginatedResult:
    items: list[Ticket]
    page: int
    page_size: int
    total: int
    total_pages: int


class TicketService:
    """Coordinates ticket creation, updates, and queue retrieval."""

    def __init__(
        self,
        ticket_repo: TicketRepository,
        user_repo: UserRepository,
        settings: Settings | None = None,
    ) -> None:
        self.ticket_repo = ticket_repo
        self.user_repo = user_repo
        self.settings = settings or get_settings()

    # -- SLA -----------------------------------------------------------------

    def calculate_due_at(self, priority: Priority, created_at: datetime) -> datetime:
        """The single authoritative SLA calculation.

        urgent -> created_at + URGENT_SLA_HOURS (default 2h)
        high -> created_at + HIGH_SLA_HOURS (default 8h)
        normal -> created_at + NORMAL_SLA_HOURS (default 24h)
        """
        hours = {
            Priority.URGENT: self.settings.urgent_sla_hours,
            Priority.HIGH: self.settings.high_sla_hours,
            Priority.NORMAL: self.settings.normal_sla_hours,
        }[priority]
        return created_at + timedelta(hours=hours)

    # -- create ---------------------------------------------------------------

    def create_ticket(
        self,
        *,
        customer_name: str,
        customer_email: str | None,
        title: str,
        description: str | None,
        priority: Priority,
    ) -> Ticket:
        created_at = utc_now()
        due_at = self.calculate_due_at(priority, created_at)

        ticket = Ticket(
            customer_name=customer_name,
            customer_email=customer_email,
            title=title,
            description=description,
            priority=priority,
            status=Status.OPEN,
            created_at=created_at,
            due_at=due_at,
        )
        return self.ticket_repo.create(ticket)

    # -- read -------------------------------------------------------------------

    def get_ticket(self, ticket_id: int) -> Ticket:
        ticket = self.ticket_repo.get(ticket_id)
        if ticket is None:
            raise TicketNotFoundError(f"Ticket {ticket_id} not found")
        return ticket

    def list_queue(self, filters: TicketFilters, page: int, page_size: int) -> PaginatedResult:
        page = max(page, 1)
        page_size = max(1, min(page_size, self.settings.max_page_size))

        now = utc_now()
        items, total = self.ticket_repo.list_paginated(filters, page, page_size, now)
        total_pages = (total + page_size - 1) // page_size if total else 0

        return PaginatedResult(
            items=items, page=page, page_size=page_size, total=total, total_pages=total_pages
        )

    def dashboard_stats(self) -> dict[str, int]:
        return self.ticket_repo.dashboard_stats(utc_now())

    def escalate_overdue_tickets(self, now: datetime | None = None) -> int:
        """Escalate each overdue active ticket by exactly one level per run."""
        escalation_time = now or utc_now()
        escalated = 0
        next_priority = {
            Priority.NORMAL: Priority.HIGH,
            Priority.HIGH: Priority.URGENT,
            Priority.URGENT: Priority.URGENT,
        }
        for ticket in self.ticket_repo.list_overdue_active(escalation_time):
            new_priority = next_priority[ticket.priority]
            if new_priority == ticket.priority:
                continue
            ticket.priority = new_priority
            ticket.due_at = self.calculate_due_at(new_priority, ticket.created_at)
            self.ticket_repo.save(ticket)
            escalated += 1
        return escalated

    # -- update -----------------------------------------------------------------

    def update_ticket(
        self,
        ticket_id: int,
        *,
        title: str | None = None,
        description: str | None = None,
        priority: Priority | None = None,
        status: Status | None = None,
        assigned_to: int | None = ...,  # type: ignore[assignment]  # sentinel: "not provided"
    ) -> Ticket:
        """Apply a partial update to a ticket.

        `assigned_to` uses `...` (Ellipsis) as a sentinel for "field not
        present in the request" so that an explicit `null` (meaning
        "unassign") can be distinguished from "leave assignment alone".
        """
        ticket = self.get_ticket(ticket_id)

        if title is not None:
            ticket.title = title
        if description is not None:
            ticket.description = description

        if priority is not None and priority != ticket.priority:
            ticket.priority = priority
            # Documented behavior: changing priority recalculates due_at
            # from the ORIGINAL created_at using the new SLA, so a ticket
            # bumped to urgent immediately reflects a 2h-from-creation
            # deadline rather than 2h-from-now. This keeps due_at
            # consistent with "the SLA the ticket is currently promised
            # under", rather than silently leaving a normal-ticket
            # deadline on a now-urgent ticket.
            ticket.due_at = self.calculate_due_at(priority, ticket.created_at)

        if status is not None:
            ticket.status = status

        if assigned_to is not ...:
            self._apply_assignment(ticket, assigned_to)

        return self.ticket_repo.save(ticket)

    # -- assignment -----------------------------------------------------------

    def assign(self, ticket_id: int, user_id: int | None) -> Ticket:
        ticket = self.get_ticket(ticket_id)
        self._apply_assignment(ticket, user_id)
        return self.ticket_repo.save(ticket)

    def _apply_assignment(self, ticket: Ticket, user_id: int | None) -> None:
        if user_id is None:
            ticket.assigned_to = None
            return

        if not self.user_repo.exists(user_id):
            raise UserNotFoundError(f"User {user_id} not found")

        ticket.assigned_to = user_id

    # -- overdue helper (exposed for schema serialization) -----------------------

    @staticmethod
    def is_overdue(ticket: Ticket) -> bool:
        return QueueService.is_overdue(ticket, utc_now())
