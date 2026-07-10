"""Add meeting_link column to appointments table.

Revision ID: 8a1b2c3d4e5f
Revises: 7f2434281430
Create Date: 2026-07-03 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "8a1b2c3d4e5f"
down_revision = "7f2434281430"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("meeting_link", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "meeting_link")
