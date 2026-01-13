-- ============================================
-- SUPABASE DATABASE SCHEMA
-- Social Media Automation Tool
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ACCOUNTS (Business Accounts)
-- ============================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Brand settings (optional)
    logo_url TEXT,
    brand_colors JSONB DEFAULT '[]'::jsonb,
    brand_voice VARCHAR(100) DEFAULT 'professional',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true
);

-- RLS for accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. SOCIAL MEDIA CONNECTIONS
-- ============================================
CREATE TABLE social_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok'
    platform_account_id VARCHAR(255), -- e.g., Facebook Page ID
    platform_account_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(account_id, platform, platform_account_id)
);

-- RLS for social_connections
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social connections"
    ON social_connections FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- ============================================
-- 3. SCHEDULED POSTS
-- ============================================
CREATE TABLE scheduled_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Content
    platforms TEXT[] NOT NULL, -- ['facebook', 'instagram']
    content TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    image_url TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR(50), -- 'weekly', 'monthly'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'published', 'failed', 'cancelled'
    published_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for scheduled_posts
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled posts"
    ON scheduled_posts FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- Index for querying pending posts
CREATE INDEX idx_scheduled_posts_status_time 
    ON scheduled_posts(status, scheduled_at) 
    WHERE status = 'pending';

-- ============================================
-- 4. POST HISTORY (Published Posts Archive)
-- ============================================
CREATE TABLE post_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    
    platform VARCHAR(50) NOT NULL,
    platform_post_id VARCHAR(255), -- ID from Facebook/Instagram/etc
    platform_post_url TEXT,
    
    content TEXT NOT NULL,
    image_url TEXT,
    
    -- Analytics (can be updated later)
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for post_history
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post history"
    ON post_history FOR SELECT
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- ============================================
-- 5. PRODUCT LIBRARY (Optional Feature)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Images stored in Supabase Storage
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own products"
    ON products FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- Index for search
CREATE INDEX idx_products_search 
    ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================
-- 6. PERSON IMAGES (Optional Feature)
-- ============================================
CREATE TABLE person_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Images stored in Supabase Storage
    image_urls TEXT[] NOT NULL, -- Multiple reference images
    
    -- AI model training status (for future fine-tuning)
    model_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'training', 'ready', 'failed'
    model_id VARCHAR(255), -- e.g., fine-tuned model ID from AI service
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for person_images
ALTER TABLE person_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own person images"
    ON person_images FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- ============================================
-- 7. DESIGN REFERENCES (Optional Feature)
-- ============================================
CREATE TABLE design_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    style_prompt TEXT, -- Extracted style description for AI
    
    -- Reference images stored in Supabase Storage
    image_urls TEXT[] NOT NULL,
    
    -- Usage count
    times_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for design_references
ALTER TABLE design_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own design references"
    ON design_references FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- ============================================
-- 8. CONTENT TEMPLATES (Optional Feature)
-- ============================================
CREATE TABLE content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL, -- 'en', 'he', 'es', 'pt'
    
    -- Template content
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- e.g., [{"name": "product_name", "type": "string"}]
    
    platforms TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    
    times_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for content_templates
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own content templates"
    ON content_templates FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- ============================================
-- 9. TEAM MEMBERS (Optional Feature)
-- ============================================
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'creator')),
    
    -- Permissions
    can_publish BOOLEAN DEFAULT false,
    can_schedule BOOLEAN DEFAULT true,
    can_edit_brand BOOLEAN DEFAULT false,
    
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(account_id, user_id)
);

-- RLS for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account owners can manage team"
    ON team_members FOR ALL
    USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

CREATE POLICY "Team members can view their memberships"
    ON team_members FOR SELECT
    USING (user_id = auth.uid());

-- ============================================
-- 10. STORAGE BUCKETS (Run in Supabase Dashboard)
-- ============================================
-- Run these commands in Supabase SQL Editor after creating tables:
/*
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('persons', 'persons', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('designs', 'designs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true);

-- Storage policies for products bucket
CREATE POLICY "Users can upload product images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view product images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'products');

-- Similar policies for other buckets...
*/

-- ============================================
-- 11. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
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

CREATE TRIGGER update_social_connections_updated_at BEFORE UPDATE ON social_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_person_images_updated_at BEFORE UPDATE ON person_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_design_references_updated_at BEFORE UPDATE ON design_references
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
