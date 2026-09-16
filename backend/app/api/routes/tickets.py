"""Ticket endpoints.

Route handlers stay thin: parse/validate input, delegate to
TicketService/AssignmentService, translate domain exceptions to HTTP
errors, and serialize the response. All business logic (SLA calculation,
queue ordering, assignment rules) lives in the service layer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import AssignmentServiceDep, TicketServiceDep
from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.ticket import Priority, Status
from app.repositories.ticket_repository import TicketFilters
from app.schemas.ticket import (
    AssignRequest,
    DashboardStats,
    PaginatedTickets,
    TicketCreate,
    TicketRead,
    TicketUpdate,
)
from app.services.ticket_service import (
    InvalidAssignmentError,
    TicketNotFoundError,
    TicketService,
    UserNotFoundError,
)

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

settings = get_settings()


def _to_read_model(ticket) -> TicketRead:
    """Attach the derived `overdue` flag when serializing a Ticket."""
    data = TicketRead.model_validate(ticket)
    data.overdue = TicketService.is_overdue(ticket)
    return data


@router.get("", response_model=PaginatedTickets, summary="List tickets (the queue)")
def list_tickets(
    ticket_service: TicketServiceDep,
    current_user=Depends(get_current_user),
    page: int = Query(default=1, ge=1, description="1-indexed page number"),
    page_size: int = Query(
        default=settings.default_page_size,
        ge=1,
        le=settings.max_page_size,
        description="Items per page (max 100)",
    ),
    priority: Priority | None = Query(default=None),
    status_filter: Status | None = Query(default=None, alias="status"),
    overdue: bool | None = Query(default=None),
    assigned_to: int | None = Query(default=None),
    customer: str | None = Query(default=None, description="Case-insensitive partial match"),
    search: str | None = Query(
        default=None, description="Search title/description/customer name/email"
    ),
) -> PaginatedTickets:
    """The main queue endpoint.

    Applies filters, then the canonical queue ordering (overdue first,
    then urgent-before-normal, then due_at, then created_at, then id),
    then server-side pagination - always in the database, never
    re-sorted or re-paginated in Python/JS.
    """
    filters = TicketFilters(
        priority=priority,
        status=status_filter,
        overdue=overdue,
        assigned_to=assigned_to,
        customer=customer,
        search=search,
    )
    result = ticket_service.list_queue(filters, page, page_size)

    return PaginatedTickets(
        items=[_to_read_model(t) for t in result.items],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        total_pages=result.total_pages,
    )


@router.get("/stats", response_model=DashboardStats, summary="Dashboard summary statistics")
def get_dashboard_stats(ticket_service: TicketServiceDep) -> DashboardStats:
    stats = ticket_service.dashboard_stats()
    return DashboardStats(**stats)


@router.post(
    "",
    response_model=TicketRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a ticket",
)
def create_ticket(
    payload: TicketCreate,
    ticket_service: TicketServiceDep,
    current_user=Depends(get_current_user),
) -> TicketRead:
    """Create a ticket. The server computes `created_at`/`due_at` from
    `priority` - clients cannot supply or override them."""
    ticket = ticket_service.create_ticket(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
    )
    return _to_read_model(ticket)


@router.get("/{ticket_id}", response_model=TicketRead, summary="Get a ticket by id")
def get_ticket(
    ticket_id: int,
    ticket_service: TicketServiceDep,
    current_user=Depends(get_current_user),
) -> TicketRead:
    try:
        ticket = ticket_service.get_ticket(ticket_id)
    except TicketNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        ) from exc
    return _to_read_model(ticket)


@router.patch("/{ticket_id}", response_model=TicketRead, summary="Update a ticket")
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    ticket_service: TicketServiceDep,
    current_user=Depends(get_current_user),
) -> TicketRead:
    """Partial update. If `priority` changes, `due_at` is recalculated
    from the ticket's original `created_at` under the new SLA (see
    TicketService.update_ticket / README for the documented behavior)."""
    update_fields = payload.model_dump(exclude_unset=True)

    try:
        ticket = ticket_service.update_ticket(
            ticket_id,
            title=update_fields.get("title"),
            description=update_fields.get("description"),
            priority=update_fields.get("priority"),
            status=update_fields.get("status"),
            assigned_to=update_fields.get("assigned_to", ...),
        )
    except TicketNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        ) from exc
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _to_read_model(ticket)


@router.post(
    "/{ticket_id}/assign", response_model=TicketRead, summary="Assign or unassign a ticket"
)
def assign_ticket(
    ticket_id: int,
    payload: AssignRequest,
    assignment_service: AssignmentServiceDep,
    current_user=Depends(get_current_user),
) -> TicketRead:
    """Assign the ticket to `user_id`, or unassign it by passing `user_id: null`."""
    try:
        ticket = assignment_service.assign_ticket(ticket_id, payload.user_id)
    except TicketNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        ) from exc
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidAssignmentError as exc:  # pragma: no cover - reserved for future rules
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _to_read_model(ticket)
