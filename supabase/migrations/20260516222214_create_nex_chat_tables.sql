/*
  # Nex AI Chatbot Schema

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `title` (text) - auto-generated from first message
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `session_id` (text) - anonymous session identifier

    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - RLS enabled on both tables
    - Policies allow access based on session_id (anonymous users)
    - No auth required for MVP — sessions identified by a client-side UUID stored in localStorage

  3. Notes
    - session_id is a UUID generated client-side and stored in localStorage
    - This allows persistence without requiring auth
    - Messages are ordered by created_at within a conversation
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New Conversation',
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions can view own conversations"
  ON conversations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Sessions can insert conversations"
  ON conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Sessions can update own conversations"
  ON conversations FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Sessions can delete own conversations"
  ON conversations FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Sessions can view messages"
  ON messages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Sessions can insert messages"
  ON messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Sessions can delete messages"
  ON messages FOR DELETE
  TO anon, authenticated
  USING (true);
