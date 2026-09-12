"""zero every subscription plan price

The subscribe endpoint has no payment step, no purchase token, no receipt and
no signature check: it sets the user's plan to whatever plan code they ask for.
Every plan is therefore free in practice, and the catalog now says so — in the
database, not only in the UI. `GET /subscriptions/plans` returns `price`, so a
Play reviewer reading network traffic sees these values; a screen that says
"₹499/month" and grants the plan on tap is an unbilled digital purchase whether
or not money moved.

Paired with a fail-closed guard in SubscriptionService.subscribe, which rejects
any plan with price > 0 with a 402. Re-pricing a plan without first
implementing purchase verification will make that plan unsubscribable rather
than free — which is the intended failure mode.

Revision ID: a1c0ffee0003
Revises: a1c0ffee0002
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1c0ffee0003'
down_revision = 'a1c0ffee0002'
branch_labels = None
depends_on = None


def upgrade():
    # 'forever' too: a rolling 30-day period on a free plan is billing shaped.
    op.execute(sa.text(
        "UPDATE subscription_plans SET price = 0, period = 'forever' WHERE price > 0"
    ))


def downgrade():
    # Prices are not restored: there is nothing to restore them to that would be
    # safe to charge, and the guard in SubscriptionService would refuse them.
    pass
