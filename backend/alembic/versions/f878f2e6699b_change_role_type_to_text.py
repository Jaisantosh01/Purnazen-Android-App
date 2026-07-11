"""change_role_type_to_text

Revision ID: f878f2e6699b
Revises: 71d856980488
Create Date: 2026-07-09 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f878f2e6699b'
down_revision = '71d856980488'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('content_pages', 'role_type',
        existing_type=sa.String(length=20),
        type_=sa.Text(),
        existing_nullable=False,
        existing_server_default='all',
    )


def downgrade():
    op.alter_column('content_pages', 'role_type',
        existing_type=sa.Text(),
        type_=sa.String(length=20),
        existing_nullable=False,
        existing_server_default='all',
    )
