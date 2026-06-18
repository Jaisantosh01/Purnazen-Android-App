"""Add roles, mapping tables, and update user role to role_id

Revision ID: ab73372465a4
Revises: 6622b83ba4e6
Create Date: 2026-06-17 12:01:08.431981

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab73372465a4'
down_revision = '6622b83ba4e6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())
    users_cols = {c['name'] for c in inspector.get_columns('users')}
    ct_cols = {c['name'] for c in inspector.get_columns('consultation_types')}

    if 'roles' not in existing_tables:
        op.create_table('roles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('updated_by', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )
        op.create_index(op.f('ix_roles_id'), 'roles', ['id'], unique=False)

    if 'role' in users_cols:
        op.execute("INSERT INTO roles (name) SELECT DISTINCT role FROM users WHERE role IS NOT NULL ON CONFLICT (name) DO NOTHING")

    if 'doctor_expertise_mapping' not in existing_tables:
        op.create_table('doctor_expertise_mapping',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('expertise_id', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('updated_by', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['expertise_id'], ['expertise.id'], ),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_doctor_expertise_mapping_id'), 'doctor_expertise_mapping', ['id'], unique=False)

    if 'doctor_language_mapping' not in existing_tables:
        op.create_table('doctor_language_mapping',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('language_id', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('updated_by', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['language_id'], ['languages.id'], ),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_doctor_language_mapping_id'), 'doctor_language_mapping', ['id'], unique=False)

    if 'doctor_speciality_mapping' not in existing_tables:
        op.create_table('doctor_speciality_mapping',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('speciality_id', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('updated_by', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['speciality_id'], ['specialties.id'], ),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_doctor_speciality_mapping_id'), 'doctor_speciality_mapping', ['id'], unique=False)

    for col, col_type in [
        ('is_active', sa.Boolean()),
        ('created_at', sa.DateTime()),
        ('updated_at', sa.DateTime()),
        ('created_by', sa.Integer()),
        ('updated_by', sa.Integer()),
    ]:
        if col not in ct_cols:
            kwargs = {'server_default': sa.text('now()')} if col == 'created_at' else {}
            op.add_column('consultation_types', sa.Column(col, col_type, nullable=True, **kwargs))

    if 'created_by' in ct_cols or 'updated_by' in ct_cols:
        pass  # FKs already exist
    else:
        op.create_foreign_key(None, 'consultation_types', 'users', ['updated_by'], ['id'])
        op.create_foreign_key(None, 'consultation_types', 'users', ['created_by'], ['id'])

    if 'role_id' not in users_cols:
        op.add_column('users', sa.Column('role_id', sa.Integer(), nullable=True))
        op.execute("UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role)")
        op.create_foreign_key(None, 'users', 'roles', ['role_id'], ['id'])

    if 'role' in users_cols:
        op.drop_column('users', 'role')


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('users', sa.Column('role', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    
    # Data migration: Restore role string from role_id
    op.execute("UPDATE users SET role = (SELECT name FROM roles WHERE roles.id = users.role_id)")
    
    op.drop_constraint(None, 'users', type_='foreignkey')
    op.drop_column('users', 'role_id')
    op.drop_constraint(None, 'consultation_types', type_='foreignkey')
    op.drop_constraint(None, 'consultation_types', type_='foreignkey')
    op.drop_column('consultation_types', 'updated_by')
    op.drop_column('consultation_types', 'created_by')
    op.drop_column('consultation_types', 'updated_at')
    op.drop_column('consultation_types', 'created_at')
    op.drop_column('consultation_types', 'is_active')
    op.drop_index(op.f('ix_doctor_speciality_mapping_id'), table_name='doctor_speciality_mapping')
    op.drop_table('doctor_speciality_mapping')
    op.drop_index(op.f('ix_doctor_language_mapping_id'), table_name='doctor_language_mapping')
    op.drop_table('doctor_language_mapping')
    op.drop_index(op.f('ix_doctor_expertise_mapping_id'), table_name='doctor_expertise_mapping')
    op.drop_table('doctor_expertise_mapping')
    op.drop_index(op.f('ix_roles_id'), table_name='roles')
    op.drop_table('roles')
    # ### end Alembic commands ###
