"""add feedback columns to therapy_sessions

Revision ID: 826af1fecc11
Revises: a4b5c6d7e8f9
Create Date: 2026-07-02 11:53:56.207741

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '826af1fecc11'
down_revision = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('therapy_sessions', sa.Column('user_pain_description', sa.String(length=500), nullable=True))
    op.add_column('therapy_sessions', sa.Column('user_feedback', sa.String(length=1000), nullable=True))
    op.add_column('therapy_sessions', sa.Column('doctor_feedback', sa.String(length=1000), nullable=True))
    op.add_column('therapy_sessions', sa.Column('admin_feedback', sa.String(length=1000), nullable=True))


def downgrade():
    op.drop_column('therapy_sessions', 'admin_feedback')
    op.drop_column('therapy_sessions', 'doctor_feedback')
    op.drop_column('therapy_sessions', 'user_feedback')
    op.drop_column('therapy_sessions', 'user_pain_description')
