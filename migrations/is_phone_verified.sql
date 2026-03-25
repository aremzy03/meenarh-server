-- Active: 1771318376114@@localhost@3306@meenarh_logistics
ALTER TABLE customers
ADD COLUMN is_phone_verified TINYINT(1) NOT NULL DEFAULT 0
AFTER default_address;

CREATE INDEX idx_customers_is_phone_verified
  ON customers (is_phone_verified);

-- Create password_reset table
CREATE TABLE password_resets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;