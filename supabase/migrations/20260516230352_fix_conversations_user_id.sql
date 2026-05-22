/*
  # Fix conversations user_id and RLS policies

  1. Problem
    - The `user_id` column on `conversations` was added but has no default value
    - INSERT RLS policy checks `WITH CHECK (auth.uid() = user_id)`, but inserts
      from the client don't set user_id, so it defaults to NULL and is rejected (403)
    - The `session_id` column is no longer needed since we moved to auth

  2. Changes
    - Delete orphaned conversations with no user_id (created during anonymous session)
    - Set `user_id` default to `auth.uid()` so inserts automatically populate it
    - Make `user_id` NOT NULL
    - Drop the old `session_id` column
*/

-- Remove orphaned rows that have no user_id
DELETE FROM conversations WHERE user_id IS NULL;

-- Set default and NOT NULL on user_id
ALTER TABLE conversations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE conversations ALTER COLUMN user_id SET NOT NULL;

-- Drop session_id column (no longer used)
ALTER TABLE conversations DROP COLUMN IF EXISTS session_id;
