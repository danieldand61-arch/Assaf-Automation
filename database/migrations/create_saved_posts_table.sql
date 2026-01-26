-- Create saved_posts table for post library
CREATE TABLE IF NOT EXISTS saved_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Post content
    text TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    call_to_action TEXT,
    image_url TEXT,
    
    -- Metadata
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title TEXT,
    notes TEXT,
    
    -- Original generation params (optional)
    source_url TEXT,
    platforms TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for fast queries
    CONSTRAINT saved_posts_account_user_fk FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, created_by)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_posts_account ON saved_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created ON saved_posts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved posts"
    ON saved_posts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own saved posts"
    ON saved_posts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own saved posts"
    ON saved_posts FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved posts"
    ON saved_posts FOR DELETE
    USING (user_id = auth.uid());

-- Add comment
COMMENT ON TABLE saved_posts IS 'Library of saved/drafted posts for later scheduling';
