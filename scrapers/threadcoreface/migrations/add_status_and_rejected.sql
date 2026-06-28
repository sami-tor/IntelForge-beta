-- Migration: Add status column to threads_users and create rejected_users table
-- Run: mysql -u madnaro -p threads_face_core < migrations/add_status_and_rejected.sql

-- Add status column to threads_users
ALTER TABLE threads_users
ADD COLUMN status ENUM('user_saved', 'processing', 'completed', 'failed') DEFAULT 'user_saved' AFTER updated_at;

-- Add index for status filtering
CREATE INDEX idx_user_status ON threads_users(status);

-- Update existing users with centroids to 'completed'
UPDATE threads_users SET status = 'completed' WHERE centroid_embedding IS NOT NULL;

-- Create rejected_users table
CREATE TABLE IF NOT EXISTS rejected_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(100) NOT NULL,
    follower_count INT DEFAULT 0,
    source_username VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rejected_username (username),
    INDEX idx_rejected_reason (reason)
);

-- Show results
SELECT 'Migration complete!' AS message;
SELECT status, COUNT(*) as count FROM threads_users GROUP BY status;
