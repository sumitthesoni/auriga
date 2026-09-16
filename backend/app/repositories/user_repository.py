"""Data access for User records."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email.ilike(email)))

    def list_all(self) -> list[User]:
        stmt = select(User).order_by(User.name.asc())
        return list(self.db.execute(stmt).scalars().all())

    def exists(self, user_id: int) -> bool:
        return self.get(user_id) is not None
