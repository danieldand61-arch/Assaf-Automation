-- Subscriptions tracking for monthly billing
-- Migration: 2026-04-02

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    package_id VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    -- status: active, canceled, past_due, unpaid, trialing
    credits_per_period INTEGER NOT NULL DEFAULT 0,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Admin bypass: allow specific users to skip subscription requirement
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS bypass_subscription BOOLEAN DEFAULT FALSE;

COMMENT ON TABLE subscriptions IS 'Monthly subscription records linked to Stripe';
COMMENT ON COLUMN user_credits.bypass_subscription IS 'Admin override — user can use product without active subscription';
