"""Thin orchestration layer for employee/assignment concerns.

Kept separate from TicketService so "who can be assigned tickets" and
"assign this ticket to that user" are one clear place to look, even
though the actual mutation of `Ticket.assigned_to` is still performed by
`TicketService` (which owns the Ticket entity and its invariants).
"""

from __future__ import annotations

from app.models.ticket import Ticket
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.ticket_service import TicketService


class AssignmentService:
    def __init__(self, user_repo: UserRepository, ticket_service: TicketService) -> None:
        self.user_repo = user_repo
        self.ticket_service = ticket_service

    def list_employees(self) -> list[User]:
        return self.user_repo.list_all()

    def assign_ticket(self, ticket_id: int, user_id: int | None) -> Ticket:
        """Assign (user_id given) or unassign (user_id=None) a ticket."""
        return self.ticket_service.assign(ticket_id, user_id)
