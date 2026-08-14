"""add tax settings table and appointment GST snapshot

Backs the admin-configurable GST percentage. `tax_settings` is a singleton row
(id=1) like `notification_settings`; appointments snapshot the rate that applied
when they were booked so an admin editing the rate never rewrites the total of a
booking that was already quoted.

Existing appointments keep NULL GST columns and are therefore treated as
tax-free, which matches what was actually charged for them.

Revision ID: d1c2b3a4e5f6
Revises: bc23de45fa67
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa

from app.db.types import GUID


revision = 'd1c2b3a4e5f6'
down_revision = 'bc23de45fa67'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tax_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gst_percentage', sa.Numeric(5, 2), nullable=False, server_default='18'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_by', GUID(), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('appointments', sa.Column('gst_percentage', sa.Numeric(5, 2), nullable=True))
    op.add_column('appointments', sa.Column('gst_amount', sa.Numeric(10, 2), nullable=True))


def downgrade():
    op.drop_column('appointments', 'gst_amount')
    op.drop_column('appointments', 'gst_percentage')
    op.drop_table('tax_settings')
