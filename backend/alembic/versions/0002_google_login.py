"""google login

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_id', sa.String(128), nullable=True))
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)
    op.alter_column('users', 'hashed_password', existing_type=sa.String(255), nullable=True)


def downgrade():
    op.alter_column('users', 'hashed_password', existing_type=sa.String(255), nullable=False)
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'google_id')
