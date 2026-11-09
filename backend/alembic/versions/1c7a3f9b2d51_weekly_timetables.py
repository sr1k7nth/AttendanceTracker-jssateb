"""weekly_timetables table

Stores one row per (student, week) of the portal's period grid so the app
can show past weeks. The current week upserts on every scrape; past weeks
are captured on first scrape (previous four) and once per new week after.

Revision ID: 1c7a3f9b2d51
Revises: a7f2c9d1e4b8
Create Date: 2026-11-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '1c7a3f9b2d51'
down_revision: Union[str, Sequence[str], None] = 'a7f2c9d1e4b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weekly_timetables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('usn', sa.String(), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('timetable', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('scraped_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['usn'], ['attendance.usn'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_weekly_timetables_usn_week',
        'weekly_timetables',
        ['usn', 'week_start'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_weekly_timetables_usn_week', table_name='weekly_timetables')
    op.drop_table('weekly_timetables')
