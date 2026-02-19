-- Add metadata JSONB column to account_connections for storing extra platform data
ALTER TABLE account_connections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
