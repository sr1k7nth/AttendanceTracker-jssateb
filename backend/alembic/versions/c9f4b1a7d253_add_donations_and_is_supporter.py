"""add donations table and is_supporter flag

Revision ID: c9f4b1a7d253
Revises: fb7ba62ec104
Create Date: 2026-09-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9f4b1a7d253'
down_revision: Union[str, Sequence[str], None] = 'fb7ba62ec104'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. attendance lost its PRIMARY KEY when `usn` was dropped in the
    #    encrypted-usn migration and later re-added as a plain column
    #    (53d8362a539b -> ffd4ea84aa31). Restore it — first de-dupe, since
    #    the missing PK means two racing first-ever logins could have
    #    inserted the same usn twice (keep the oldest physical row).
    op.execute(
        "DELETE FROM attendance a USING attendance b "
        "WHERE a.usn = b.usn AND a.ctid > b.ctid"
    )
    op.create_primary_key("attendance_pkey", "attendance", ["usn"])

    # 2. supporter flag — server_default keeps every existing row safe
    op.add_column(
        'attendance',
        sa.Column(
            'is_supporter',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )

    # 3. donations table
    op.create_table(
        'donations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'usn',
            sa.String(),
            sa.ForeignKey('attendance.usn', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('name', sa.String(30), nullable=False),
        sa.Column('message', sa.String(200), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column(
            'anonymous', sa.Boolean(), nullable=False, server_default=sa.text('false')
        ),
        sa.Column('screenshot_file', sa.String(), nullable=False),
        sa.Column(
            'status', sa.String(16), nullable=False, server_default='pending'
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # The restored attendance PK is intentionally NOT dropped here — it's a
    # repair of a much older bug, and the table needs it regardless.
    op.drop_table('donations')
    op.drop_column('attendance', 'is_supporter')
