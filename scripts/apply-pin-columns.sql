-- Run this in Supabase Dashboard → SQL Editor for project fvtriqmplruyjinewpid
-- Enables pin/unpin to persist in the database (not just locally)

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_is_pinned
  ON conversations(user_id, is_pinned DESC, updated_at DESC);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz DEFAULT NULL;
