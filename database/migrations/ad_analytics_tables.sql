-- Unified ad analytics cache tables
-- Stores synced data from Google Ads and Meta Business APIs

-- Campaign-level data (unified across platforms)
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta')),
    platform_campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNKNOWN',
    campaign_type TEXT,           -- Search/Display/Shopping/Video/PMax | awareness/traffic/conversions/leads
    objective TEXT,               -- Meta: campaign objective
    daily_budget NUMERIC(12,2),
    lifetime_budget NUMERIC(12,2),
    currency TEXT DEFAULT 'USD',
    -- Metrics
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    spend NUMERIC(12,4) DEFAULT 0,
    avg_cpc NUMERIC(8,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    conversion_rate NUMERIC(8,4) DEFAULT 0,
    cost_per_conversion NUMERIC(12,4) DEFAULT 0,
    roas NUMERIC(8,2) DEFAULT 0,
    reach BIGINT DEFAULT 0,
    frequency NUMERIC(6,2) DEFAULT 0,
    -- Google Ads specific
    search_impression_share NUMERIC(6,2),
    lost_impression_share_budget NUMERIC(6,2),
    lost_impression_share_rank NUMERIC(6,2),
    -- Date range & sync
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(account_id, platform, platform_campaign_id, date_from, date_to)
);

-- Ad group / Ad set level data
CREATE TABLE IF NOT EXISTS ad_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta')),
    platform_adgroup_id TEXT NOT NULL,
    platform_campaign_id TEXT NOT NULL,
    adgroup_name TEXT NOT NULL,
    status TEXT DEFAULT 'UNKNOWN',
    -- Meta targeting details
    targeting_audience TEXT,
    targeting_age_range TEXT,
    targeting_gender TEXT,
    targeting_locations TEXT,
    targeting_interests TEXT,
    -- Metrics
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    spend NUMERIC(12,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(account_id, platform, platform_adgroup_id, date_from, date_to)
);

-- Keyword-level data (Google Ads only)
CREATE TABLE IF NOT EXISTS ad_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    platform_campaign_id TEXT NOT NULL,
    platform_adgroup_id TEXT NOT NULL,
    keyword_text TEXT NOT NULL,
    match_type TEXT,              -- BROAD, PHRASE, EXACT
    quality_score INTEGER,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    avg_cpc NUMERIC(8,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Device segmentation
CREATE TABLE IF NOT EXISTS ad_device_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_campaign_id TEXT NOT NULL,
    device TEXT NOT NULL,         -- MOBILE, DESKTOP, TABLET, OTHER
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend NUMERIC(12,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Geographic performance
CREATE TABLE IF NOT EXISTS ad_geo_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_campaign_id TEXT NOT NULL,
    country TEXT,
    region TEXT,
    city TEXT,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend NUMERIC(12,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Placement breakdown (Meta only: Feed, Stories, Reels, etc.)
CREATE TABLE IF NOT EXISTS ad_placement_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform_campaign_id TEXT NOT NULL,
    placement TEXT NOT NULL,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend NUMERIC(12,4) DEFAULT 0,
    conversions NUMERIC(12,2) DEFAULT 0,
    reach BIGINT DEFAULT 0,
    date_from DATE,
    date_to DATE,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Sync log (tracks last sync per account+platform)
CREATE TABLE IF NOT EXISTS ad_sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    campaigns_synced INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE(account_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_account ON ad_campaigns(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_ad_groups_campaign ON ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_keywords_campaign ON ad_keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_sync_log_account ON ad_sync_log(account_id, platform);

-- RLS
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_device_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_geo_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placement_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sync_log ENABLE ROW LEVEL SECURITY;
