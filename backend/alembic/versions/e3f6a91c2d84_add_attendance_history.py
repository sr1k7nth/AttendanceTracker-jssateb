"""add attendance_history table

One row per login: the overall percentage at the moment the portal was
re-scraped, plus when. Feeds the attendance-progression graph.

Revision ID: e3f6a91c2d84
Revises: b1d47e2a9c05
Create Date: 2026-10-12 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f6a91c2d84'
down_revision: Union[str, Sequence[str], None] = 'b1d47e2a9c05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'attendance_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'usn',
            sa.String(),
            sa.ForeignKey('attendance.usn', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('total_avg', sa.Float(), nullable=False),
        sa.Column(
            'recorded_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )
    op.create_index(
        'ix_attendance_history_usn_recorded_at',
        'attendance_history',
        ['usn', 'recorded_at'],
    )

    # Seed every existing account with a single point — its last scrape — so
    # the graph isn't empty for everyone until their next login.
    op.execute(
        "INSERT INTO attendance_history (usn, total_avg, recorded_at) "
        "SELECT usn, COALESCE(total_avg, 0), COALESCE(timestamp, now()) "
        "FROM attendance "
        "WHERE usn IS NOT NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'ix_attendance_history_usn_recorded_at', table_name='attendance_history'
    )
    op.drop_table('attendance_history')
