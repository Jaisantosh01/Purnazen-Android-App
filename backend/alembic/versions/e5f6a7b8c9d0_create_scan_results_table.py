"""create scan_results table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-14 11:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'scan_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('scan_id', sa.Integer(), nullable=False),
        # Face metrics (0–100, NULL for tongue scans)
        sa.Column('hydration_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('oiliness_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('wrinkle_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('pigmentation_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('dark_circle_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('pore_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('elasticity_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('muscle_tone_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('inflammation_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('glow_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('toxin_indicator', sa.Numeric(5, 2), nullable=True),
        # Tongue metrics (NULL for face scans)
        sa.Column('tongue_body_color', sa.String(30), nullable=True),
        sa.Column('tongue_coat_color', sa.String(30), nullable=True),
        sa.Column('tongue_coat_thick', sa.String(20), nullable=True),
        sa.Column('tongue_moisture', sa.String(20), nullable=True),
        sa.Column('tongue_shape', sa.String(30), nullable=True),
        # Audit / AI retraining
        sa.Column('raw_metrics', sa.JSON(), nullable=True),
        sa.Column('overall_wellness_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('skin_age_estimate', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['scan_id'], ['face_scans.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scan_id', name='uq_scan_results_scan_id'),
    )


def downgrade():
    op.drop_table('scan_results')
