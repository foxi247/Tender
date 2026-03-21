-- Add AI chat mode flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_chat_mode BOOLEAN NOT NULL DEFAULT false;
