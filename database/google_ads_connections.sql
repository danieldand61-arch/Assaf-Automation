-- Google Ads API Connections Table
-- Stores user's Google Ads account connections

CREATE TABLE IF NOT EXISTS google_ads_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,  -- Google Ads customer ID (without dashes)
    refresh_token TEXT NOT NULL,  -- OAuth2 refresh token (should be encrypted)
    status TEXT NOT NULL DEFAULT 'active',  -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one connection per user
    UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_user_id 
ON google_ads_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_google_ads_connections_status 
ON google_ads_connections(status);

-- RLS Policies
ALTER TABLE google_ads_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connections
CREATE POLICY "Users can view own Google Ads connections"
ON google_ads_connections FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own connections
CREATE POLICY "Users can create own Google Ads connections"
ON google_ads_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update own Google Ads connections"
ON google_ads_connections FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete own Google Ads connections"
ON google_ads_connections FOR DELETE
USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_ads_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_google_ads_connections_timestamp ON google_ads_connections;
CREATE TRIGGER update_google_ads_connections_timestamp
BEFORE UPDATE ON google_ads_connections
FOR EACH ROW
EXECUTE FUNCTION update_google_ads_connections_updated_at();
