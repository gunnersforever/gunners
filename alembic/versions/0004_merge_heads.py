"""merge heads

Revision ID: 0004_merge_heads
Revises: 0003_add_price_cache, 0003_add_user_theme_mode
Create Date: 2026-02-13 00:00:00.000000
"""

# revision identifiers, used by Alembic.
revision = '0004_merge_heads'
down_revision = ('0003_add_price_cache', '0003_add_user_theme_mode')
branch_labels = None
depends_on = None


def upgrade():
    # merge only; no schema changes
    pass


def downgrade():
    # merge only; no schema changes
    pass
