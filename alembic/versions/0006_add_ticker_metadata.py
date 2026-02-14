"""add ticker metadata

Revision ID: 0006_add_ticker_metadata
Revises: 0005_add_advisor_history
Create Date: 2026-02-14 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006_add_ticker_metadata'
down_revision = '0005_add_advisor_history'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ticker_metadata',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_ticker_metadata_symbol', 'ticker_metadata', ['symbol'], unique=True)


def downgrade():
    op.drop_index('ix_ticker_metadata_symbol', table_name='ticker_metadata')
    op.drop_table('ticker_metadata')
