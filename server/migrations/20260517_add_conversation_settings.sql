-- Add conversation settings to allow per-user pin/mute/block/hide
CREATE TABLE IF NOT EXISTS conversation_settings (
  conversation_id BIGINT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  is_pinned TINYINT(1) DEFAULT 0,
  is_muted TINYINT(1) DEFAULT 0,
  is_blocked TINYINT(1) DEFAULT 0,
  is_hidden TINYINT(1) DEFAULT 0,
  pinned_at TIMESTAMP NULL DEFAULT NULL,
  muted_until TIMESTAMP NULL DEFAULT NULL,
  blocked_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_pinned (is_pinned),
  INDEX idx_muted (is_muted),
  INDEX idx_blocked (is_blocked),
  INDEX idx_hidden (is_hidden)
);

-- Rollback
-- DROP TABLE IF EXISTS conversation_settings;
