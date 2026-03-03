"""add AuditLog model

Revision ID: 0003_add_audit_log
Revises: 0002_add_token_type
Create Date: 2026-03-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_add_audit_log'
down_revision = '0002_add_token_type'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource', sa.String(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='success'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('username', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_username'), 'audit_logs', ['username'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_username'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
