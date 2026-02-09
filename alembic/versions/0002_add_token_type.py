"""add token_type to SessionToken

Revision ID: 0002_add_token_type
Revises: 0001_initial
Create Date: 2026-02-05 00:00:00.000100
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_token_type'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {col['name'] for col in inspector.get_columns('session_tokens')}
    if 'token_type' not in cols:
        op.add_column('session_tokens', sa.Column('token_type', sa.String(), nullable=False, server_default='access'))
    if 'created_at' not in cols:
        op.add_column('session_tokens', sa.Column('created_at', sa.DateTime(), nullable=True))
    if bind.dialect.name != 'sqlite':
        op.alter_column('session_tokens', 'token_type', server_default=None)


def downgrade():
    op.drop_column('session_tokens', 'created_at')
    op.drop_column('session_tokens', 'token_type')
