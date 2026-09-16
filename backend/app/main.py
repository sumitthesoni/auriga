"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import auth, health, tickets, users
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.services.ticket_service import TicketService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("helpdesk")

settings = get_settings()


def run_escalation_once() -> int:
    db = SessionLocal()
    try:
        service = TicketService(TicketRepository(db), UserRepository(db), settings)
        escalated = service.escalate_overdue_tickets()
        db.commit()
        return escalated
    except Exception:
        db.rollback()
        logger.exception("Automatic ticket escalation failed")
        return 0
    finally:
        db.close()


async def escalation_loop() -> None:
    while True:
        await asyncio.to_thread(run_escalation_once)
        await asyncio.sleep(settings.escalation_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(escalation_loop())
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=(
        "A generic helpdesk ticket management system. The core feature is "
        "the queue ordering rule: overdue tickets first, then urgent "
        "before normal, then earliest due_at, with deterministic "
        "tie-breaks on created_at and id. See the README for full "
        "details."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health.router, prefix="/api")
app.include_router(tickets.router)
app.include_router(users.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return FastAPI's normal 422 shape without leaking internals."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Never leak stack traces / SQL details to clients; log server-side."""
    logger.exception("Database error handling %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again later."},
    )


@app.get("/", tags=["health"], summary="API root")
def root() -> dict[str, str]:
    return {
        "message": "Helpdesk Ticket Management System API",
        "docs": "/docs",
        "health": "/api/health",
    }
