-- Add credits_charged flag to track whether credits were deducted for this task
ALTER TABLE video_tasks ADD COLUMN IF NOT EXISTS credits_charged BOOLEAN DEFAULT FALSE;
