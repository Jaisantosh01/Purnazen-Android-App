"""add_role_type_to_content_pages

Revision ID: 71d856980488
Revises: 98a6672451a1
Create Date: 2026-07-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '71d856980488'
down_revision = '98a6672451a1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('content_pages', sa.Column('role_type', sa.String(length=20), nullable=False, server_default='all'))


def downgrade():
    op.drop_column('content_pages', 'role_type')
