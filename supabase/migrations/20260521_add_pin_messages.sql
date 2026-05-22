/*
  # Add message pinning functionality

  1. New Column
    - `messages.is_pinned` (boolean, default false) - marks a message as pinned
    - `messages.pinned_at` (timestamptz, nullable) - timestamp when message was pinned

  2. Indexes
    - Add index on is_pinned for faster queries to display pinned messages

  3. Notes
    - Users can pin/unpin messages in a conversation
    - Pinned messages can be displayed at the top of a conversation
*/

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON messages(conversation_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_messages_pinned_at ON messages(pinned_at DESC) WHERE is_pinned = true;
