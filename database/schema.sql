-- =============================================
-- SOCIAL MEDIA AUTOMATION - DATABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS & ACCOUNTS
-- =============================================

-- Users table (managed by Supabase Auth)
-- auth.users is built-in, we just add our custom fields via user_settings

-- Business Accounts (each user can have multiple business accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    target_audience VARCHAR(255),
    brand_voice VARCHAR(100) DEFAULT 'professional',
    
    -- Brand Assets
    logo_url TEXT,
    brand_colors JSONB DEFAULT '[]'::jsonb, -- ["#FF5733", "#33FF57"]
    
    -- Extended onboarding data
    metadata JSONB DEFAULT '{}'::jsonb, -- {website_url, marketing_goal, geographic_focus, budget_range}
    
    -- Settings
    default_language VARCHAR(10) DEFAULT 'en',
    default_include_emojis BOOLEAN DEFAULT true,
    default_include_logo BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- User Settings (preferences, active account)
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    theme VARCHAR(20) DEFAULT 'light', -- 'light', 'dark', 'auto'
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. SOCIAL MEDIA API CONNECTIONS
-- =============================================

CREATE TABLE account_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok'
    
    -- OAuth tokens (encrypted in production!)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Platform-specific data
    platform_user_id VARCHAR(255),
    platform_username VARCHAR(255),
    platform_profile_url TEXT,
    
    -- Connection status
    is_connected BOOLEAN DEFAULT false,
    last_connected_at TIMESTAMPTZ,
    connection_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, platform)
);

-- =============================================
-- 3. SCHEDULED POSTS
-- =============================================

CREATE TABLE scheduled_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Post Content
    text TEXT NOT NULL,
    hashtags JSONB DEFAULT '[]'::jsonb, -- ["coffee", "morning"]
    call_to_action TEXT,
    
    -- Image
    image_url TEXT,
    image_storage_path TEXT, -- Path in Supabase Storage
    
    -- Scheduling
    scheduled_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    platforms JSONB NOT NULL, -- ["instagram", "facebook"]
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'publishing', 'published', 'failed', 'cancelled'
    published_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Publishing results per platform
    publish_results JSONB DEFAULT '{}'::jsonb, -- {"instagram": {"success": true, "post_id": "123"}}
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for scheduler to find pending posts
CREATE INDEX idx_scheduled_posts_pending ON scheduled_posts(scheduled_time, status) 
WHERE status = 'pending';

-- =============================================
-- 4. PRODUCT LIBRARY (OPTIONAL)
-- =============================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Images
    images JSONB DEFAULT '[]'::jsonb, -- [{"url": "...", "storage_path": "..."}]
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. PERSON-SPECIFIC IMAGES (OPTIONAL)
-- =============================================

CREATE TABLE persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100), -- 'brand_ambassador', 'owner', 'spokesperson'
    description TEXT,
    
    -- Reference photos
    photos JSONB DEFAULT '[]'::jsonb, -- [{"url": "...", "storage_path": "..."}]
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. DESIGN REFERENCES (OPTIONAL)
-- =============================================

CREATE TABLE design_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    style_type VARCHAR(100), -- 'modern', 'minimalist', 'vintage', etc.
    
    -- Reference images
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Is this a saved template?
    is_template BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. TEAM PERMISSIONS (OPTIONAL)
-- =============================================

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'creator'
    permissions JSONB DEFAULT '{}'::jsonb, -- {"can_publish": true, "can_schedule": true}
    
    -- Metadata
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    UNIQUE(account_id, user_id)
);

-- Team Invitations
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
    
    UNIQUE(account_id, email)
);

-- =============================================
-- 8. POST HISTORY & ANALYTICS (OPTIONAL)
-- =============================================

CREATE TABLE post_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    
    -- Post data snapshot
    text TEXT,
    image_url TEXT,
    platforms JSONB,
    published_at TIMESTAMPTZ,
    
    -- Analytics (can be updated via webhook from platforms)
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;

-- Accounts: Users can only see their own accounts or accounts they're team members of
CREATE POLICY "Users can view their own accounts"
    ON accounts FOR SELECT
    USING (
        user_id = auth.uid() 
        OR id IN (
            SELECT account_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create their own accounts"
    ON accounts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own accounts"
    ON accounts FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own accounts"
    ON accounts FOR DELETE
    USING (user_id = auth.uid());

-- User Settings: Users can only manage their own settings
CREATE POLICY "Users can manage their own settings"
    ON user_settings FOR ALL
    USING (user_id = auth.uid());

-- Account Connections: Users can manage connections for their accounts
CREATE POLICY "Users can manage their account connections"
    ON account_connections FOR ALL
    USING (
        account_id IN (
            SELECT id FROM accounts WHERE user_id = auth.uid()
        )
    );

-- Scheduled Posts: Users can manage posts for their accounts
CREATE POLICY "Users can manage scheduled posts"
    ON scheduled_posts FOR ALL
    USING (
        account_id IN (
            SELECT id FROM accounts WHERE user_id = auth.uid()
            UNION
            SELECT account_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Similar policies for other tables...
CREATE POLICY "Users can manage products" ON products FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage persons" ON persons FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage design references" ON design_references FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_connections_updated_at BEFORE UPDATE ON account_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_design_references_updated_at BEFORE UPDATE ON design_references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_account_connections_account_id ON account_connections(account_id);
CREATE INDEX idx_scheduled_posts_account_id ON scheduled_posts(account_id);
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_products_account_id ON products(account_id);
CREATE INDEX idx_persons_account_id ON persons(account_id);
CREATE INDEX idx_design_references_account_id ON design_references(account_id);
CREATE INDEX idx_team_members_account_id ON team_members(account_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
