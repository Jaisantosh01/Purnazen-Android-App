"""create support_contacts and support_faqs tables

Backs the Help & Support screen with admin-configurable data instead of
hardcoded placeholders.

Revision ID: e2f3a4b5c6d7
Revises: d7e8f9a0b1c2
Create Date: 2026-06-26 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'e2f3a4b5c6d7'
down_revision = 'd7e8f9a0b1c2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'support_contacts',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('contact_type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('subtitle', sa.String(150), nullable=True),
        sa.Column('value', sa.String(255), nullable=True),
        sa.Column('icon', sa.String(60), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'support_faqs',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('question', sa.String(255), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', GUID(), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('support_faqs')
    op.drop_table('support_contacts')
