"""feedback reply columns

The admin can answer a feedback submission; the reply is shown to the user
as a summary-page banner (same loop as donation review notices).

Revision ID: 9b2f7e5d3a14
Revises: 6d4e8a1c9f27
Create Date: 2026-11-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b2f7e5d3a14'
down_revision: Union[str, Sequence[str], None] = '6d4e8a1c9f27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('feedback', sa.Column('reply', sa.String(length=1000), nullable=True))
    op.add_column('feedback', sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('feedback', 'replied_at')
    op.drop_column('feedback', 'reply')
