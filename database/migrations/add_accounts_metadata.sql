-- Add metadata column to accounts table for extended onboarding data
-- Migration: 2026-02-04

-- Add metadata column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE accounts ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Update existing accounts with empty metadata if NULL
UPDATE accounts SET metadata = '{}'::jsonb WHERE metadata IS NULL;

-- Add comment
COMMENT ON COLUMN accounts.metadata IS 'Extended onboarding data: website_url, marketing_goal, geographic_focus, budget_range, etc';
