"""donation screenshot nullable + reject reason

Screenshots are deleted as soon as a donation is reviewed (approved or
rejected) — the row keeps the audit data but the image is no longer needed.
`reject_reason` records why a proof was bounced so the donor can see it.

Revision ID: a7f2c9d1e4b8
Revises: c259ee56d7c0
Create Date: 2026-11-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7f2c9d1e4b8'
down_revision: Union[str, Sequence[str], None] = 'c259ee56d7c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('donations', 'screenshot_file', existing_type=sa.String(), nullable=True)
    op.add_column('donations', sa.Column('reject_reason', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('donations', 'reject_reason')
    # backfill empties before re-adding NOT NULL
    op.execute("UPDATE donations SET screenshot_file = '' WHERE screenshot_file IS NULL")
    op.alter_column('donations', 'screenshot_file', existing_type=sa.String(), nullable=False)
