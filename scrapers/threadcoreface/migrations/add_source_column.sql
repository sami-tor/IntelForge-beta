-- Migration: Add source_username column to track where users came from
-- Run: mysql -u madnaro -p threads_face_core < migrations/add_source_column.sql

-- Add source_username column
ALTER TABLE threads_users
ADD COLUMN source_username VARCHAR(255) DEFAULT NULL AFTER status;

-- Add index for filtering by source
CREATE INDEX idx_source_username ON threads_users(source_username);

-- Show results
SELECT 'Migration complete!' AS message;
SELECT source_username, COUNT(*) as count FROM threads_users GROUP BY source_username;
