"""create therapy_sessions table

Revision ID: 9d4e7b21c8aa
Revises: f3a9c2d41b07
Create Date: 2026-06-12 10:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9d4e7b21c8aa'
down_revision = 'f3a9c2d41b07'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('therapy_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=150), nullable=False),
    sa.Column('session_type', sa.String(length=30), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('pain_before', sa.Integer(), nullable=True),
    sa.Column('pain_after', sa.Integer(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_therapy_sessions_user_completed', 'therapy_sessions', ['user_id', 'completed_at'], unique=False)


def downgrade():
    op.drop_index('ix_therapy_sessions_user_completed', table_name='therapy_sessions')
    op.drop_table('therapy_sessions')
