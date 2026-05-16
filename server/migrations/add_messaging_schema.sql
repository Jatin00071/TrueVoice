-- TrueVoice Messaging schema
-- Additive-only migration: creates new messaging tables without altering existing tables.

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_1_id INT UNSIGNED NOT NULL,
  user_2_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_timestamp TIMESTAMP NULL,
  is_archived TINYINT DEFAULT 0,
  FOREIGN KEY (user_1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_2_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_conversation (user_1_id, user_2_id),
  INDEX idx_users (user_1_id, user_2_id),
  INDEX idx_last_message (last_message_timestamp)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  encrypted_content LONGTEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  salt VARCHAR(32) NOT NULL,
  is_read TINYINT DEFAULT 0,
  is_edited TINYINT DEFAULT 0,
  edited_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  unsent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_created (created_at),
  INDEX idx_read (is_read)
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS unsent_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS message_queue (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  encrypted_content LONGTEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  salt VARCHAR(32) NOT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 10,
  last_retry_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation_status (conversation_id, status),
  INDEX idx_user_status (user_id, status),
  INDEX idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS message_visibility (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  is_hidden TINYINT DEFAULT 0,
  hidden_at TIMESTAMP NULL,
  UNIQUE KEY unique_visibility (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_hidden (user_id, is_hidden)
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  encrypted_file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  INDEX idx_message (message_id)
);

CREATE TABLE IF NOT EXISTS encryption_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  public_key LONGTEXT NOT NULL,
  key_fingerprint VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_key (conversation_id, user_id),
  INDEX idx_conversation (conversation_id)
);

CREATE TABLE IF NOT EXISTS message_read_receipts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_receipt (message_id, user_id)
);
