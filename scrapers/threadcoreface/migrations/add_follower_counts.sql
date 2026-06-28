-- Add follower and following counts to threads_users table
-- Run this migration to add follower tracking

ALTER TABLE threads_users
ADD COLUMN follower_count INT DEFAULT 0 AFTER face_count;

ALTER TABLE threads_users
ADD COLUMN following_count INT DEFAULT 0 AFTER follower_count;

-- Add index for filtering
CREATE INDEX idx_follower_count ON threads_users(follower_count);
