"""create scan_recommendations table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-14 11:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'scan_recommendations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('scan_id', sa.Integer(), nullable=False),
        sa.Column('recommendation_type', sa.String(30), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('routine_key', sa.String(80), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('tip_category', sa.String(50), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['scan_id'], ['face_scans.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scan_recommendations_scan_id', 'scan_recommendations', ['scan_id'])


def downgrade():
    op.drop_index('ix_scan_recommendations_scan_id', table_name='scan_recommendations')
    op.drop_table('scan_recommendations')
