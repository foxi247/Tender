-- =============================================
-- Tender Bot — Initial Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- =============================================
-- USERS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tariff_plan TEXT NOT NULL DEFAULT 'free' CHECK (tariff_plan IN ('free', 'basic', 'pro'))
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =============================================
-- USER PREFERENCES
-- =============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]',
  regions JSONB NOT NULL DEFAULT '[]',
  min_budget NUMERIC(18, 2),
  max_budget NUMERIC(18, 2),
  keywords JSONB NOT NULL DEFAULT '[]',
  excluded_keywords JSONB NOT NULL DEFAULT '[]',
  preferred_laws JSONB NOT NULL DEFAULT '[]',
  delivery_radius INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- =============================================
-- TENDERS
-- =============================================
CREATE TABLE IF NOT EXISTS tenders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  region TEXT,
  buyer_name TEXT,
  law_type TEXT CHECK (law_type IN ('44-FZ', '223-FZ', 'commercial', 'other')),
  budget NUMERIC(18, 2),
  published_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  source_url TEXT,
  docs_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled', 'awarded')),
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenders_external_id ON tenders(external_id);
CREATE INDEX idx_tenders_category ON tenders(category);
CREATE INDEX idx_tenders_region ON tenders(region);
CREATE INDEX idx_tenders_status ON tenders(status);
CREATE INDEX idx_tenders_deadline_at ON tenders(deadline_at);
CREATE INDEX idx_tenders_published_at ON tenders(published_at);
CREATE INDEX idx_tenders_budget ON tenders(budget);
-- Full text search index
CREATE INDEX idx_tenders_title_trgm ON tenders USING gin(title gin_trgm_ops);

-- =============================================
-- USER TENDER ACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS user_tender_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('favorite', 'in_work', 'hidden', 'viewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Each user can have one action per tender per type
  UNIQUE(user_id, tender_id, action_type)
);

CREATE INDEX idx_user_tender_actions_user_id ON user_tender_actions(user_id);
CREATE INDEX idx_user_tender_actions_tender_id ON user_tender_actions(tender_id);
CREATE INDEX idx_user_tender_actions_type ON user_tender_actions(action_type);

-- =============================================
-- DAILY DIGESTS
-- =============================================
CREATE TABLE IF NOT EXISTS daily_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenders_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT
);

CREATE INDEX idx_daily_digests_user_id ON daily_digests(user_id);
CREATE INDEX idx_daily_digests_sent_at ON daily_digests(sent_at);
CREATE INDEX idx_daily_digests_status ON daily_digests(status);

-- =============================================
-- BOT LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS bot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bot_logs_user_id ON bot_logs(user_id);
CREATE INDEX idx_bot_logs_event_type ON bot_logs(event_type);
CREATE INDEX idx_bot_logs_created_at ON bot_logs(created_at);

-- =============================================
-- APP SETTINGS (for admin-managed config)
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CHAT HISTORY (for AI memory)
-- =============================================
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at);

-- =============================================
-- UPDATE TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenders_updated_at
  BEFORE UPDATE ON tenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- DEFAULT APP SETTINGS
-- =============================================
INSERT INTO app_settings (key, value, description) VALUES
  ('ai_provider', 'mistral', 'Active AI provider: mistral | openai | rule-based'),
  ('mistral_api_key', '', 'Mistral API key (overrides env var)'),
  ('mistral_model', 'mistral-medium-latest', 'Mistral model to use'),
  ('openai_api_key', '', 'OpenAI API key (overrides env var)'),
  ('openai_model', 'gpt-4o', 'OpenAI model to use'),
  ('digest_hour', '6', 'Daily digest hour (UTC)'),
  ('digest_minute', '0', 'Daily digest minute (UTC)'),
  ('digest_enabled', 'true', 'Enable daily digest sending'),
  ('max_tenders_per_digest', '5', 'Maximum tenders per daily digest'),
  ('bot_token', '', 'Telegram bot token (overrides env var)')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tender_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by bot backend)
-- Public API uses service role key for all bot operations

-- Allow authenticated users (admin) to read all data
CREATE POLICY "Service role full access" ON users
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON user_preferences
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON user_tender_actions
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON daily_digests
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON bot_logs
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON chat_history
  USING (true) WITH CHECK (true);
