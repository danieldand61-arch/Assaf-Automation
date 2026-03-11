-- Add video tracking and auto-expiry to saved_posts
ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS is_video BOOLEAN DEFAULT FALSE;
ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_saved_posts_expires ON saved_posts(expires_at) WHERE expires_at IS NOT NULL;

-- Function to delete expired video posts and their storage files
CREATE OR REPLACE FUNCTION delete_expired_saved_posts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM saved_posts
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron (optional, only if enabled in Supabase):
-- SELECT cron.schedule('delete-expired-saved-posts', '0 3 * * *', 'SELECT delete_expired_saved_posts()');
