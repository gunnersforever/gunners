"""add price cache table

Revision ID: 0003_add_price_cache
Revises: 0002_add_token_type
Create Date: 2026-02-12 00:00:00.000100
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_add_price_cache'
down_revision = '0002_add_token_type'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if 'price_cache' not in tables:
        op.create_table(
            'price_cache',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
            sa.Column('symbol', sa.String(), nullable=False),
            sa.Column('price', sa.Float(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_price_cache_symbol', 'price_cache', ['symbol'], unique=True)


def downgrade():
    op.drop_index('ix_price_cache_symbol', table_name='price_cache')
    op.drop_table('price_cache')
