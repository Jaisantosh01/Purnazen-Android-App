"""add users.auth_provider for social sign-in

Revision ID: f0a1b2c3d4e5
Revises: b1c2d3e4f5a6
Create Date: 2026-07-07
"""
import sqlalchemy as sa
from alembic import op

revision = "f0a1b2c3d4e5"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("auth_provider", sa.String(length=20), nullable=True))


def downgrade():
    op.drop_column("users", "auth_provider")
