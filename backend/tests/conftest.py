"""Shared pytest fixtures.

Tests run against a real PostgreSQL database (the "helpdesk_test"
database) so that the actual SQL ordering/filtering logic - not a SQLite
approximation of it - is what gets verified. Each test gets a clean
schema via a transaction that's rolled back afterwards, plus a
per-test-controllable fake clock so queue/overdue behavior can be tested
deterministically instead of racing real wall-clock time.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/helpdesk_test",
)

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.ticket import Priority, Status, Ticket  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.datetime import override_clock, reset_clock  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(TEST_DATABASE_URL, future=True)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    """Create all tables once for the whole test session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_clock_after_each_test():
    yield
    reset_clock()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """A plain DB session for unit tests, with cleanup between tests."""
    connection = engine.connect()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        # Wipe data (not schema) between tests so each test starts fresh.
        connection.execute(Ticket.__table__.delete())
        connection.execute(User.__table__.delete())
        connection.commit()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """A TestClient wired to use the same session as `db_session`,
    wrapped so route-handler commits don't close the session between
    the test setting up data and the request reading it."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def fixed_now() -> datetime:
    """A stable reference time: 2026-01-15 15:00:00 UTC ('3:00 PM')."""
    now = datetime(2026, 1, 15, 15, 0, 0, tzinfo=UTC)
    override_clock(now)
    return now


def make_user(db: Session, *, name: str = "Test Agent", email: str | None = None) -> User:
    user = User(
        name=name,
        email=email or f"{name.lower().replace(' ', '.')}@example.com",
        password_hash=hash_password("Project"),
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def make_ticket(
    db: Session,
    *,
    created_at: datetime,
    due_at: datetime,
    priority: Priority = Priority.NORMAL,
    status: Status = Status.OPEN,
    customer_name: str = "Test Customer",
    customer_email: str | None = "customer@example.com",
    title: str = "Test ticket",
    description: str | None = "A test ticket",
    assigned_to: int | None = None,
) -> Ticket:
    ticket = Ticket(
        customer_name=customer_name,
        customer_email=customer_email,
        title=title,
        description=description,
        priority=priority,
        status=status,
        created_at=created_at,
        due_at=due_at,
        assigned_to=assigned_to,
    )
    db.add(ticket)
    db.flush()
    db.refresh(ticket)
    return ticket


__all__ = ["make_user", "make_ticket", "timedelta"]
