"""Shared FastAPI dependencies: DB session -> repositories -> services."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.services.assignment_service import AssignmentService
from app.services.ticket_service import TicketService

DbSession = Annotated[Session, Depends(get_db)]


def get_ticket_repository(db: DbSession) -> TicketRepository:
    return TicketRepository(db)


def get_user_repository(db: DbSession) -> UserRepository:
    return UserRepository(db)


TicketRepo = Annotated[TicketRepository, Depends(get_ticket_repository)]
UserRepo = Annotated[UserRepository, Depends(get_user_repository)]


def get_ticket_service(ticket_repo: TicketRepo, user_repo: UserRepo) -> TicketService:
    return TicketService(ticket_repo, user_repo)


TicketServiceDep = Annotated[TicketService, Depends(get_ticket_service)]


def get_assignment_service(
    user_repo: UserRepo, ticket_service: TicketServiceDep
) -> AssignmentService:
    return AssignmentService(user_repo, ticket_service)


AssignmentServiceDep = Annotated[AssignmentService, Depends(get_assignment_service)]
