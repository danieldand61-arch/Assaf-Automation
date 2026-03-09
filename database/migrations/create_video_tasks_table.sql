-- Video generation tasks tracking table
CREATE TABLE IF NOT EXISTS video_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    estimated_credits INTEGER DEFAULT 0,
    video_urls JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_tasks_user_id ON video_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_video_tasks_task_id ON video_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_video_tasks_status ON video_tasks(status);

ALTER TABLE video_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video tasks"
    ON video_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video tasks"
    ON video_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to video_tasks"
    ON video_tasks FOR ALL
    USING (auth.role() = 'service_role');
