"""add theme_mode to users

Revision ID: 0003_add_user_theme_mode
Revises: 0002_add_token_type
Create Date: 2026-02-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_add_user_theme_mode'
down_revision = '0002_add_token_type'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {col['name'] for col in inspector.get_columns('users')}
    if 'theme_mode' not in cols:
        op.add_column('users', sa.Column('theme_mode', sa.String(), nullable=False, server_default='light'))
    if bind.dialect.name != 'sqlite':
        op.alter_column('users', 'theme_mode', server_default=None)


def downgrade():
    op.drop_column('users', 'theme_mode')
