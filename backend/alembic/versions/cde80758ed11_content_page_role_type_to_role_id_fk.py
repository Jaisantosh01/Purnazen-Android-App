"""content_page: replace role_type (text) with role_id (FK to roles)

Revision ID: cde80758ed11
Revises: f878f2e6699b
Create Date: 2026-07-11 09:00:59.469402

"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID


revision = "cde80758ed11"
down_revision = "f878f2e6699b"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("TRUNCATE TABLE content_pages")
    op.drop_column("content_pages", "role_type")
    op.add_column(
        "content_pages",
        sa.Column("role_id", GUID(), sa.ForeignKey("roles.id"), nullable=False),
    )


def downgrade():
    op.drop_column("content_pages", "role_id")
    op.add_column(
        "content_pages",
        sa.Column(
            "role_type",
            sa.Text(),
            server_default=sa.text("'all'"),
            nullable=False,
        ),
    )
