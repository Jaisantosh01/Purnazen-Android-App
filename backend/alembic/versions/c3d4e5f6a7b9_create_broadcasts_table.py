"""create broadcasts table

Stores each admin broadcast (sent or scheduled) so the admin app can list
recent broadcasts, duplicate one to resend, and schedule future sends.

Revision ID: c3d4e5f6a7b9
Revises: a2b3c4d5e6f0
Create Date: 2026-07-09

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'c3d4e5f6a7b9'
down_revision = 'a2b3c4d5e6f0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'broadcasts',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('audience', sa.String(20), nullable=False, server_default='all'),
        sa.Column('segment', sa.String(30), nullable=False, server_default='everyone'),
        sa.Column('category', sa.String(20), nullable=False, server_default='promo'),
        sa.Column('status', sa.String(20), nullable=False, server_default='sent'),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('recipients_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_broadcasts_status', 'broadcasts', ['status'])


def downgrade():
    op.drop_index('ix_broadcasts_status', table_name='broadcasts')
    op.drop_table('broadcasts')
