-- Add source column to tenders (which platform the tender came from)
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'bicotender';
CREATE INDEX IF NOT EXISTS idx_tenders_source ON tenders(source);

-- Add preferred_sources to user_preferences (empty = all platforms)
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferred_sources JSONB NOT NULL DEFAULT '[]';
