-- Fix face_identities: add unique constraint on name column
-- This enables ON CONFLICT DO NOTHING for demo seed data
-- Run this BEFORE the face identities seed

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_face_identities_name'
  ) THEN
    ALTER TABLE face_identities ADD CONSTRAINT unique_face_identities_name UNIQUE (name);
  END IF;
END $$;
