"""Add leaderboard alias."""

from alembic import op
import sqlalchemy as sa


revision = "9d3a7c2e6b10"
down_revision = "6c01139595d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Preserve existing accounts
    op.add_column("attendance", sa.Column("alias", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance", "alias")
