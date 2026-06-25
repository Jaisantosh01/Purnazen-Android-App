"""Add gender, phone, date_of_birth to users table

Revision ID: a1b2c3d4e5f8
Revises: c464e974e875
Create Date: 2026-06-23 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f8"
down_revision = "c464e974e875"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(15), nullable=True))
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "date_of_birth")
    op.drop_column("users", "phone")
    op.drop_column("users", "gender")
