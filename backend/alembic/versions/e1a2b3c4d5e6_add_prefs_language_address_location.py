"""Add language, address, location_enabled to user_preferences

Revision ID: e1a2b3c4d5e6
Revises: a1b2c3d4e5f8
Create Date: 2026-06-26

Backs the Settings features: app language, saved address, and the location
access toggle. Stored on user_preferences (the per-user settings row) so they
sync across devices alongside notification preferences.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e1a2b3c4d5e6"
down_revision = "a1b2c3d4e5f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("address", sa.String(255), nullable=True),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "location_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "location_enabled")
    op.drop_column("user_preferences", "address")
    op.drop_column("user_preferences", "language")
