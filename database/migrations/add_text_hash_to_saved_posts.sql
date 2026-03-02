-- Add text_hash column for deduplication
ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS text_hash TEXT;

-- Create index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_saved_posts_text_hash ON saved_posts(account_id, text_hash);

-- Backfill existing posts
UPDATE saved_posts SET text_hash = md5(trim(text)) WHERE text_hash IS NULL;
