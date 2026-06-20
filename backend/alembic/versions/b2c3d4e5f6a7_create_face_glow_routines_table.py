"""create face_glow_routines table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'face_glow_routines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(80), nullable=False),
        sa.Column('icon', sa.String(10), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('duration', sa.String(30), nullable=False),
        sa.Column('benefits', sa.JSON(), nullable=False),
        sa.Column('category', sa.String(50), nullable=False, server_default='acupressure'),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )

    # Seed the 4 existing hardcoded routines so no mobile changes are needed
    op.bulk_insert(
        sa.table(
            'face_glow_routines',
            sa.column('key', sa.String),
            sa.column('icon', sa.String),
            sa.column('title', sa.String),
            sa.column('duration', sa.String),
            sa.column('benefits', sa.JSON),
            sa.column('category', sa.String),
            sa.column('sort_order', sa.Integer),
            sa.column('is_active', sa.Boolean),
        ),
        [
            {
                'key': 'MorningGlow',
                'icon': '🌅',
                'title': 'Morning Glow Routine',
                'duration': '10 min',
                'benefits': ['Reduces puffiness', 'Boosts circulation', 'Awakens skin tone'],
                'category': 'acupressure',
                'sort_order': 0,
                'is_active': True,
            },
            {
                'key': 'FacialAcupressure',
                'icon': '💆',
                'title': 'Facial Acupressure',
                'duration': '8 min',
                'benefits': ['Relieves tension headaches', 'Lifts cheekbones', 'Smooths fine lines'],
                'category': 'acupressure',
                'sort_order': 1,
                'is_active': True,
            },
            {
                'key': 'NightRepair',
                'icon': '🌙',
                'title': 'Night Repair Routine',
                'duration': '12 min',
                'benefits': ['Promotes cell renewal', 'Deep relaxation', 'Reduces dark circles'],
                'category': 'acupressure',
                'sort_order': 2,
                'is_active': True,
            },
            {
                'key': 'GuaShaFlow',
                'icon': '✨',
                'title': 'Gua Sha Flow',
                'duration': '15 min',
                'benefits': ['Sculpts jawline', 'Drains lymph nodes', 'Brightens complexion'],
                'category': 'gua_sha',
                'sort_order': 3,
                'is_active': True,
            },
        ],
    )


def downgrade():
    op.drop_table('face_glow_routines')
