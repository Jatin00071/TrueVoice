CREATE DATABASE truevoice_db;
USE truevoice_db;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  bio VARCHAR(300) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  is_verified TINYINT(1) DEFAULT 1,
  verification_token VARCHAR(255) DEFAULT NULL,
  refresh_token_hash VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  content TEXT DEFAULT NULL,
  media_url VARCHAR(500) DEFAULT NULL,
  media_type ENUM('image','video') DEFAULT NULL,
  is_reshare TINYINT(1) DEFAULT 0,
  original_post_id INT UNSIGNED DEFAULT NULL,
  shield_active TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (original_post_id) REFERENCES posts(id),
  INDEX idx_created (created_at),
  INDEX idx_user (user_id)
);

CREATE TABLE fingerprints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL UNIQUE,
  hash CHAR(64) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  INDEX idx_hash (hash)
);

CREATE TABLE comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  status ENUM('approved','pending','rejected') DEFAULT 'approved',
  flagged_reason VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_post_created (post_id, created_at)
);

CREATE TABLE likes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_like (post_id, user_id)
);

CREATE TABLE follows (
  follower_id INT UNSIGNED NOT NULL,
  following_id INT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  type ENUM('like','comment','follow','shield_activated','content_reshared') NOT NULL,
  post_id INT UNSIGNED DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES users(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_recipient (recipient_id, created_at)
);

CREATE TABLE shield_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  trigger_type ENUM('auto','manual') NOT NULL,
  comment_count_at_trigger INT UNSIGNED DEFAULT NULL,
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deactivated_at DATETIME DEFAULT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

ALTER TABLE fingerprints
  ADD COLUMN phash VARCHAR(256) DEFAULT NULL,
  ADD COLUMN fingerprint_type ENUM('image','text','both') NOT NULL DEFAULT 'image',
  ADD INDEX idx_phash (phash);

ALTER TABLE users
  ADD COLUMN notif_likes TINYINT(1) DEFAULT 1,
  ADD COLUMN notif_comments TINYINT(1) DEFAULT 1,
  ADD COLUMN notif_follows TINYINT(1) DEFAULT 1,
  ADD COLUMN notif_shield TINYINT(1) DEFAULT 1,
  ADD COLUMN notif_reshares TINYINT(1) DEFAULT 1;

ALTER TABLE users
  ADD COLUMN is_private TINYINT(1) DEFAULT 0,
  ADD COLUMN fingerprinting_enabled TINYINT(1) DEFAULT 1,
  ADD COLUMN shield_enabled TINYINT(1) DEFAULT 1;

ALTER TABLE comments
  ADD COLUMN deleted_by_shield TINYINT(1) DEFAULT 0,
  ADD COLUMN toxicity_category VARCHAR(100) DEFAULT NULL;

ALTER TABLE posts
  ADD COLUMN shield_enabled TINYINT(1) DEFAULT 0,
  ADD COLUMN post_flagged TINYINT(1) DEFAULT 0,
  ADD COLUMN post_flag_reason TEXT DEFAULT NULL,
  ADD COLUMN shield_deleted_count INT DEFAULT 0,
  ADD COLUMN shield_activated_at DATETIME DEFAULT NULL;

CREATE TABLE IF NOT EXISTS shield_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  report_date DATE NOT NULL,
  auto_deleted_count INT DEFAULT 0,
  hate_speech_count INT DEFAULT 0,
  abuse_count INT DEFAULT 0,
  spam_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE KEY uq_post_date (post_id, report_date)
);

ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'like','comment','follow',
    'shield_activated','content_reshared','post_removed'
  ) NOT NULL;
