/*
  # Add email uniqueness and ensure user isolation

  1. Changes to profiles table
    - Add unique constraint on email to prevent duplicate emails
    - Supabase Auth already enforces email uniqueness on auth.users
    - This adds an extra safety layer

  2. Changes to conversations table
    - Ensure user_id is NOT NULL for authenticated users
    - Add index on user_id for better query performance

  3. Notes
    - Email uniqueness is enforced at the auth.users level by Supabase
    - The constraint on profiles.email is an additional safety measure
    - All existing conversations should be migrated to have user_id set
*/

-- Add unique constraint on email in profiles table
ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Make user_id NOT NULL and add index for conversations
ALTER TABLE conversations ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Add updated_at index for better ordering performance
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(user_id, updated_at DESC);
