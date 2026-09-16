"""add high priority and user password

Revision ID: 7c1f9b7d2a11
Revises: 2f92f319cb94
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "7c1f9b7d2a11"
down_revision: Union[str, None] = "2f92f319cb94"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# PBKDF2-SHA256 hash for the demo password "Project".
DEFAULT_PASSWORD_HASH = (
    "pbkdf2_sha256$600000$kUrrwbBdlrPLIkw2wgH8IA$" "rsu7ybmd8Sj2lv7NcGH2HXs8z4JLOu5LkccX5xx8UyQ"
)


def upgrade() -> None:
    op.execute("ALTER TYPE ticket_priority ADD VALUE IF NOT EXISTS 'high'")
    op.add_column(
        "users",
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
            server_default=DEFAULT_PASSWORD_HASH,
        ),
    )
    op.alter_column("users", "password_hash", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "password_hash")
    # PostgreSQL does not safely remove an enum value in place. The high
    # value is retained for existing databases when rolling back this revision.
