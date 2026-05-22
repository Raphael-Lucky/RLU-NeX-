/*
  # Harden auth uniqueness and per-user conversation isolation

  - Keep profile emails unique as a second layer beneath Supabase Auth.
  - Ensure conversations always belong to an authenticated user.
  - Ensure messages can only be read, inserted, updated, or deleted through
    conversations owned by the signed-in user.
*/

UPDATE profiles
SET email = lower(trim(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower_unique
  ON profiles (lower(email))
  WHERE email <> '';

ALTER TABLE conversations ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);

DROP POLICY IF EXISTS "Sessions can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Sessions can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Sessions can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Sessions can delete own conversations" ON conversations;

DROP POLICY IF EXISTS "Authenticated users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can delete own conversations" ON conversations;

CREATE POLICY "Authenticated users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sessions can view messages" ON messages;
DROP POLICY IF EXISTS "Sessions can insert messages" ON messages;
DROP POLICY IF EXISTS "Sessions can delete messages" ON messages;

DROP POLICY IF EXISTS "Authenticated users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Authenticated users can update messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Authenticated users can delete messages in own conversations" ON messages;

CREATE POLICY "Authenticated users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update messages in own conversations"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete messages in own conversations"
  ON messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
