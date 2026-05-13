-- Email verification: flag on customers + tokens table for the verification link sent via Resend.

ALTER TABLE customers
  ADD COLUMN is_email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_phone_verified;

CREATE INDEX idx_customers_is_email_verified
  ON customers (is_email_verified);

CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  -- Hex SHA-256 of the opaque verification token. The plaintext token is only ever in the recipient's email.
  token_sha256 CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  last_sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY uq_email_verifications_token (token_sha256),
  INDEX idx_email_verifications_user_active (user_id, used, expires_at)
);
