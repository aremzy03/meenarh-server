-- Phone verification tokens (single-use)
CREATE TABLE IF NOT EXISTS phone_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_phone_verifications_user (user_id),
  INDEX idx_phone_verifications_expires (expires_at),
  INDEX idx_phone_verifications_used (used)
);
