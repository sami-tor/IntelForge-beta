-- Initialize threads_face_core database

CREATE DATABASE IF NOT EXISTS threads_face_core CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE threads_face_core;

-- Table: threads_users
CREATE TABLE IF NOT EXISTS threads_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    threads_id BIGINT,
    full_name VARCHAR(255),
    bio TEXT,
    country_tag VARCHAR(64),
    profile_photo VARCHAR(255),
    centroid_embedding BLOB,
    face_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_threads_id (threads_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: threads_faces
CREATE TABLE IF NOT EXISTS threads_faces (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    embedding BLOB,
    similarity_to_centroid FLOAT,
    is_root TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES threads_users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_root (is_root)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: scrape_queue
CREATE TABLE IF NOT EXISTS scrape_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('pending', 'processing', 'done', 'error') DEFAULT 'pending',
    last_try TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
