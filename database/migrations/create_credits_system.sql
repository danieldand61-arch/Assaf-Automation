-- Credits tracking system for AI usage
-- Migration: 2026-02-04

-- User credits balance
CREATE TABLE IF NOT EXISTS user_credits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_credits_purchased DECIMAL(10,2) DEFAULT 0,
    credits_used DECIMAL(10,2) DEFAULT 0,
    credits_remaining DECIMAL(10,2) DEFAULT 0,
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits usage log (every AI request)
CREATE TABLE IF NOT EXISTS credits_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Request details
    service_type VARCHAR(50) NOT NULL, -- 'chat', 'google_ads', 'social_posts', 'image_generation'
    action VARCHAR(100), -- specific action: 'generate_headlines', 'chat_message', etc
    
    -- AI model info
    model_name VARCHAR(100), -- 'gemini-3-flash-preview', 'dall-e-3', etc
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Cost calculation
    cost_per_token DECIMAL(10,8), -- Cost per token for this model
    credits_spent DECIMAL(10,4) NOT NULL, -- Total credits spent on this request
    
    -- Additional metadata
    request_metadata JSONB DEFAULT '{}'::jsonb, -- {prompt_length, response_length, etc}
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_credits_usage_user_id ON credits_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_usage_created_at ON credits_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_credits_usage_service_type ON credits_usage(service_type);

-- Function to update user credits balance
CREATE OR REPLACE FUNCTION update_user_credits_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update credits_used and credits_remaining
    UPDATE user_credits
    SET 
        credits_used = credits_used + NEW.credits_spent,
        credits_remaining = total_credits_purchased - (credits_used + NEW.credits_spent),
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    -- If user doesn't exist, create record with negative balance (debt)
    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, credits_used, credits_remaining)
        VALUES (NEW.user_id, NEW.credits_spent, -NEW.credits_spent);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update balance after each usage
DROP TRIGGER IF EXISTS trigger_update_credits_balance ON credits_usage;
CREATE TRIGGER trigger_update_credits_balance
    AFTER INSERT ON credits_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_user_credits_balance();

-- Initialize existing users with 0 credits
INSERT INTO user_credits (user_id, total_credits_purchased, credits_used, credits_remaining)
SELECT id, 0, 0, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Comments
COMMENT ON TABLE user_credits IS 'User credits balance for AI usage';
COMMENT ON TABLE credits_usage IS 'Log of all AI requests and their cost';
COMMENT ON COLUMN credits_usage.service_type IS 'Type of service: chat, google_ads, social_posts, image_generation';
COMMENT ON COLUMN credits_usage.credits_spent IS 'Credits spent on this request (based on tokens * rate)';
