"""create appointments table

Revision ID: f3a9c2d41b07
Revises: 002e423e11b1
Create Date: 2026-06-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3a9c2d41b07'
down_revision = '002e423e11b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('appointments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('doctor_id', sa.Integer(), nullable=False),
    sa.Column('consultation_type_id', sa.Integer(), nullable=True),
    sa.Column('visit_type', sa.String(length=20), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('slot_start', sa.Time(), nullable=False),
    sa.Column('slot_end', sa.Time(), nullable=False),
    sa.Column('fee', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['consultation_type_id'], ['consultation_types.id'], ),
    sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_appointments_doctor_date', 'appointments', ['doctor_id', 'date'], unique=False)


def downgrade():
    op.drop_index('ix_appointments_doctor_date', table_name='appointments')
    op.drop_table('appointments')
