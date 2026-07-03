"""create_user_addresses_table_and_update_appointments

Revision ID: 7f2434281430
Revises: 1dd9c36eec4d
Create Date: 2026-07-03 10:08:18.133875

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7f2434281430'
down_revision = '1dd9c36eec4d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_addresses',
        sa.Column('id', postgresql.UUID(), nullable=False),
        sa.Column('user_id', postgresql.UUID(), nullable=False),
        sa.Column('house_name', sa.String(length=255), nullable=True),
        sa.Column('area', sa.String(length=255), nullable=True),
        sa.Column('landmark', sa.String(length=255), nullable=True),
        sa.Column('pincode', sa.String(length=20), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('type_of_address', sa.String(length=50), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', postgresql.UUID(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.add_column('appointments', sa.Column('clinic_id', postgresql.UUID(), nullable=True))
    op.add_column('appointments', sa.Column('user_address_id', postgresql.UUID(), nullable=True))
    op.create_foreign_key(None, 'appointments', 'clinics', ['clinic_id'], ['id'])
    op.create_foreign_key(None, 'appointments', 'user_addresses', ['user_address_id'], ['id'])


def downgrade():
    op.drop_constraint(None, 'appointments', type_='foreignkey')
    op.drop_constraint(None, 'appointments', type_='foreignkey')
    op.drop_column('appointments', 'user_address_id')
    op.drop_column('appointments', 'clinic_id')
    op.drop_table('user_addresses')
