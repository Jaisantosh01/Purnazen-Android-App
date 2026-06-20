"""add progress_stage and landmarks_json to face_scans

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('face_scans', sa.Column('progress_stage', sa.String(40), nullable=True))
    op.add_column('face_scans', sa.Column('landmarks_json', sa.Text(), nullable=True))
    # blur_score (Laplacian variance) routinely exceeds 99.99 for in-focus photos;
    # the original Numeric(6,4) overflowed and failed the scan before detection.
    op.alter_column('face_scans', 'blur_score', type_=sa.Numeric(10, 2))


def downgrade():
    op.alter_column('face_scans', 'blur_score', type_=sa.Numeric(6, 4))
    op.drop_column('face_scans', 'landmarks_json')
    op.drop_column('face_scans', 'progress_stage')
