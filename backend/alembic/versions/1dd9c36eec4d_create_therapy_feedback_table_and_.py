"""create_therapy_feedback_table_and_cleanup_sessions

Revision ID: 1dd9c36eec4d
Revises: 826af1fecc11
Create Date: 2026-07-02 12:24:13.006778

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '1dd9c36eec4d'
down_revision = '826af1fecc11'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('therapy_feedback',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('user_id', postgresql.UUID(), nullable=False),
        sa.Column('video_group_id', postgresql.UUID(), nullable=False),
        sa.Column('session_type', sa.String(length=30), nullable=False),
        sa.Column('pain_before', sa.Integer(), nullable=True),
        sa.Column('pain_after', sa.Integer(), nullable=True),
        sa.Column('user_pain_description', sa.String(length=500), nullable=True),
        sa.Column('user_feedback', sa.String(length=1000), nullable=True),
        sa.Column('doctor_feedback', sa.String(length=1000), nullable=True),
        sa.Column('doctor_feedback_by', postgresql.UUID(), nullable=True),
        sa.Column('admin_feedback', sa.String(length=1000), nullable=True),
        sa.Column('admin_feedback_by', postgresql.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', postgresql.UUID(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['admin_feedback_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['doctor_feedback_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['video_group_id'], ['video_groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.drop_column('therapy_sessions', 'pain_before')
    op.drop_column('therapy_sessions', 'pain_after')
    op.drop_column('therapy_sessions', 'user_pain_description')
    op.drop_column('therapy_sessions', 'user_feedback')
    op.drop_column('therapy_sessions', 'doctor_feedback')
    op.drop_column('therapy_sessions', 'admin_feedback')


def downgrade():
    op.add_column('therapy_sessions', sa.Column('admin_feedback', sa.VARCHAR(length=1000), autoincrement=False, nullable=True))
    op.add_column('therapy_sessions', sa.Column('doctor_feedback', sa.VARCHAR(length=1000), autoincrement=False, nullable=True))
    op.add_column('therapy_sessions', sa.Column('user_feedback', sa.VARCHAR(length=1000), autoincrement=False, nullable=True))
    op.add_column('therapy_sessions', sa.Column('user_pain_description', sa.VARCHAR(length=500), autoincrement=False, nullable=True))
    op.add_column('therapy_sessions', sa.Column('pain_after', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('therapy_sessions', sa.Column('pain_before', sa.INTEGER(), autoincrement=False, nullable=True))
    op.drop_table('therapy_feedback')
