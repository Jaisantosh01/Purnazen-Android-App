"""create session catalog tables (wellness_sessions, relief_sessions)

Revision ID: b7c1f4e92d35
Revises: 9d4e7b21c8aa
Create Date: 2026-06-12 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c1f4e92d35'
down_revision = '9d4e7b21c8aa'
branch_labels = None
depends_on = None


def _catalog_columns():
    return [
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('duration_label', sa.String(length=30), nullable=False),
        sa.Column('icon', sa.String(length=20), nullable=True),
        sa.Column('video_url', sa.String(length=500), nullable=True),
        sa.Column('total_cycles', sa.Integer(), nullable=False),
        sa.Column('steps', sa.JSON(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    ]


def upgrade():
    op.create_table('wellness_sessions', *_catalog_columns())
    op.create_table('relief_sessions', *_catalog_columns())


def downgrade():
    op.drop_table('relief_sessions')
    op.drop_table('wellness_sessions')
