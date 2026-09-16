from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.ticket import Priority, Status
from app.schemas.user import UserRead


def _non_empty(value: str, field_name: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{field_name} cannot be empty")
    return stripped


class TicketCreate(BaseModel):
    """Payload for POST /api/tickets.

    Deliberately has NO created_at/due_at fields: the server is the only
    party allowed to compute those, per the SLA rule.
    """

    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_email: EmailStr | None = None
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    priority: Priority

    @field_validator("customer_name")
    @classmethod
    def customer_name_not_blank(cls, v: str) -> str:
        return _non_empty(v, "customer_name")

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        return _non_empty(v, "title")


class TicketUpdate(BaseModel):
    """Payload for PATCH /api/tickets/{id}. All fields optional."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    priority: Priority | None = None
    status: Status | None = None
    assigned_to: int | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank_if_present(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _non_empty(v, "title")


class AssignRequest(BaseModel):
    """Payload for POST /api/tickets/{id}/assign.

    `user_id: null` unassigns the ticket.
    """

    user_id: int | None = None


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    customer_email: str | None
    title: str
    description: str | None
    priority: Priority
    status: Status
    created_at: datetime
    due_at: datetime
    updated_at: datetime
    assigned_to: int | None
    assignee: UserRead | None = None
    overdue: bool = False


class PaginatedTickets(BaseModel):
    items: list[TicketRead]
    page: int
    page_size: int
    total: int
    total_pages: int


class DashboardStats(BaseModel):
    open_tickets: int
    overdue: int
    urgent: int
    unassigned: int
