"""add login_attempts

Rejected portal logins — the per-USN failure rate limit. Failures only:
successful scrapes are counted one-per-login by attendance_history (that
count is the daily cap), so this table exists purely to answer "was this
key rejected N times recently?". Written by routes/scrape.py on a 401,
cleared for that key on the next success.

Revision ID: c259ee56d7c0
Revises: e3f6a91c2d84
Create Date: 2026-10-23 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c259ee56d7c0'
down_revision: Union[str, Sequence[str], None] = 'e3f6a91c2d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'login_attempts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )
    op.create_index(
        'ix_login_attempts_key_created_at',
        'login_attempts',
        ['key', 'created_at'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_login_attempts_key_created_at', table_name='login_attempts')
    op.drop_table('login_attempts')
