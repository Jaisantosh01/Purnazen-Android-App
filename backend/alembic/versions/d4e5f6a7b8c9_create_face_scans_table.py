"""create face_scans table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-14 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'face_scans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('scan_type', sa.String(20), nullable=False, server_default='face'),
        sa.Column('status', sa.String(20), nullable=False, server_default='queued'),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('processed_image_url', sa.String(500), nullable=True),
        sa.Column('image_public_id', sa.String(200), nullable=True),
        sa.Column('processed_image_public_id', sa.String(200), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('face_detected', sa.Boolean(), nullable=True),
        sa.Column('face_confidence', sa.Numeric(5, 4), nullable=True),
        sa.Column('lighting_quality', sa.String(20), nullable=True),
        sa.Column('blur_score', sa.Numeric(6, 4), nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.Column('processing_started_at', sa.DateTime(), nullable=True),
        sa.Column('processing_completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_face_scans_user_created', 'face_scans', ['user_id', 'created_at'])
    op.create_index('ix_face_scans_status', 'face_scans', ['status'])


def downgrade():
    op.drop_index('ix_face_scans_status', table_name='face_scans')
    op.drop_index('ix_face_scans_user_created', table_name='face_scans')
    op.drop_table('face_scans')
