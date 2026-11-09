"""feedback table

In-app feedback with four categories (feedback / error / feature /
data_removal); error and data_removal carry a screenshot, data_removal also
records the user's last portal scrape time as identity proof. The
(usn, created_at) index backs the 3-per-day submission cap.

Revision ID: 6d4e8a1c9f27
Revises: 1c7a3f9b2d51
Create Date: 2026-11-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d4e8a1c9f27'
down_revision: Union[str, Sequence[str], None] = '1c7a3f9b2d51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('usn', sa.String(), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('message', sa.String(length=1000), nullable=True),
        sa.Column('screenshot_file', sa.String(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='new'),
        sa.Column('last_scraped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['usn'], ['attendance.usn'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_feedback_usn_created_at', 'feedback', ['usn', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_feedback_usn_created_at', table_name='feedback')
    op.drop_table('feedback')
