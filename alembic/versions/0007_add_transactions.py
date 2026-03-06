"""add transactions table for transaction history

Revision ID: 0007_add_transactions
Revises: 0006_add_ticker_metadata
Create Date: 2026-03-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0007_add_transactions'
down_revision = '0006_add_ticker_metadata'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('transaction_type', sa.String(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolios.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_user_id'), 'transactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_transactions_portfolio_id'), 'transactions', ['portfolio_id'], unique=False)
    op.create_index(op.f('ix_transactions_symbol'), 'transactions', ['symbol'], unique=False)
    op.create_index(op.f('ix_transactions_created_at'), 'transactions', ['created_at'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_transactions_created_at'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_symbol'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_portfolio_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_user_id'), table_name='transactions')
    op.drop_table('transactions')
