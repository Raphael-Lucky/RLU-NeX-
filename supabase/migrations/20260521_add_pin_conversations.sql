/*
  # Add conversation pinning and rename

  1. New Columns
    - `conversations.is_pinned` (boolean, default false) - marks a conversation as pinned
    - `conversations.pinned_at` (timestamptz, nullable) - timestamp when conversation was pinned

  2. Indexes
    - Add index on is_pinned for faster queries to display pinned conversations first

  3. Notes
    - Users can pin/unpin conversations to keep important ones at the top
    - Pinned conversations appear above unpinned ones in the sidebar
*/

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_is_pinned ON conversations(user_id, is_pinned DESC, updated_at DESC);
