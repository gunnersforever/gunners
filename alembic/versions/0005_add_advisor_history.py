"""add advisor history

Revision ID: 0005_add_advisor_history
Revises: 0004_merge_heads
Create Date: 2026-02-13 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005_add_advisor_history'
down_revision = '0004_merge_heads'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'advisor_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('profile_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('recommendations_json', sa.Text(), nullable=False, server_default='[]'),
    )
    op.create_index('ix_advisor_history_user_id', 'advisor_history', ['user_id'])
    # remove defaults where supported
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.alter_column('advisor_history', 'profile_json', server_default=None)
        op.alter_column('advisor_history', 'recommendations_json', server_default=None)


def downgrade():
    op.drop_index('ix_advisor_history_user_id', table_name='advisor_history')
    op.drop_table('advisor_history')
