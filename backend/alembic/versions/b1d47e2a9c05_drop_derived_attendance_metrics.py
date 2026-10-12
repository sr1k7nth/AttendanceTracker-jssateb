"""drop derived attendance metrics

The four columns were pure functions of the stored `summary` JSONB, so they
are computed on read instead (api.metrics / AttendanceResponse computed
fields). `total_avg` stays a column because the leaderboard sorts by it.

Revision ID: b1d47e2a9c05
Revises: 34f42079fe9b
Create Date: 2026-10-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1d47e2a9c05'
down_revision: Union[str, Sequence[str], None] = '34f42079fe9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('attendance', 'can_miss85')
    op.drop_column('attendance', 'can_miss75')
    op.drop_column('attendance', 'need_to_attend85')
    op.drop_column('attendance', 'need_to_attend75')


def downgrade() -> None:
    """Downgrade schema.

    The values are regenerable from `summary` on the next login, so the
    re-added columns are nullable with no backfill.
    """
    op.add_column('attendance', sa.Column('can_miss85', sa.Integer(), nullable=True))
    op.add_column('attendance', sa.Column('can_miss75', sa.Integer(), nullable=True))
    op.add_column('attendance', sa.Column('need_to_attend85', sa.Integer(), nullable=True))
    op.add_column('attendance', sa.Column('need_to_attend75', sa.Integer(), nullable=True))
