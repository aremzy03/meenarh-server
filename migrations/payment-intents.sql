-- Payment intents for Paystack (initialize → verify/webhook fulfill)
CREATE TABLE IF NOT EXISTS payment_intents (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  reference VARCHAR(100) NOT NULL,
  amount_kobo INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  status ENUM('pending', 'paid', 'failed', 'fulfilled') NOT NULL DEFAULT 'pending',
  scope ENUM('full_cart', 'single_item') NOT NULL,
  cart_item_id INT NULL,
  promo_code VARCHAR(64) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fulfilled_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uk_payment_intents_reference (reference),
  KEY idx_payment_intents_user (user_id),
  KEY idx_payment_intents_status (status),
  CONSTRAINT fk_payment_intents_user FOREIGN KEY (user_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
