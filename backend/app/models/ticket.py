"""Ticket model plus its Priority/Status enums.

Overdue-ness is intentionally NOT a stored column. It is always derived
from `due_at` vs "now" combined with `status` (see
`app.services.queue_service`), so it can never drift out of sync with
reality just because nobody re-ran a batch job.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Priority(str, enum.Enum):
    URGENT = "urgent"
    HIGH = "high"
    NORMAL = "normal"


class Status(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


# Statuses considered "closed out" of the active queue. A ticket in one of
# these states no longer counts toward overdue calculations even if its
# due_at has passed - it already got a resolution.
INACTIVE_STATUSES = (Status.RESOLVED, Status.CLOSED)


class Ticket(Base):
    """A single helpdesk support ticket."""

    __tablename__ = "tickets"
    __table_args__ = (
        # Composite indexes tuned for the queries the API actually runs:
        # the queue ordering itself, and the most common filter combos.
        Index("ix_tickets_status_due_at", "status", "due_at"),
        Index("ix_tickets_priority_status", "priority", "status"),
        Index("ix_tickets_assigned_to_status", "assigned_to", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    customer_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    priority: Mapped[Priority] = mapped_column(
        SAEnum(
            Priority,
            name="ticket_priority",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    status: Mapped[Status] = mapped_column(
        SAEnum(
            Status,
            name="ticket_status",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=Status.OPEN,
        server_default=Status.OPEN.value,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    assignee: Mapped[User | None] = relationship(
        back_populates="assigned_tickets", foreign_keys=[assigned_to]
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Ticket id={self.id} priority={self.priority} status={self.status}>"
