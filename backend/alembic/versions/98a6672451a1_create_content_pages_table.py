"""create_content_pages_table

Revision ID: 98a6672451a1
Revises: fcf1701ebc35
Create Date: 2026-07-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from app.db.types import GUID


revision = '98a6672451a1'
down_revision = 'a2b3c4d5e6f0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('content_pages',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False, server_default='1.0'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_content_pages_type'), 'content_pages', ['type'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_content_pages_type'), table_name='content_pages')
    op.drop_table('content_pages')
