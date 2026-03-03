ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS instagram_post_type TEXT DEFAULT 'post';
