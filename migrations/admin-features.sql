-- Migration: Admin panel features
-- Date: 2026-02-26

USE meenarh_logistics;

-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content LONGTEXT NOT NULL,
  cover_image_url VARCHAR(500) DEFAULT NULL,
  author_id INT NOT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_blog_status (status),
  INDEX idx_blog_slug (slug)
);

-- Company settings (key-value store)
CREATE TABLE IF NOT EXISTS company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default company settings
INSERT INTO company_settings (setting_key, setting_value) VALUES
  ('company_name', 'Meenarh Logistics'),
  ('tagline', 'Fast, trackable deliveries across Lagos.'),
  ('phone', '08000000000'),
  ('email', 'info@meenarh.com'),
  ('address', 'Lagos, Nigeria'),
  ('whatsapp', '2348000000000')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Promo / discount codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('percentage', 'fixed') NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,
  min_order_value DECIMAL(10, 2) DEFAULT NULL,
  max_uses INT DEFAULT NULL,
  current_uses INT NOT NULL DEFAULT 0,
  expires_at DATETIME DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promo_code (code),
  INDEX idx_promo_active (is_active)
);

-- Promo code usage log
CREATE TABLE IF NOT EXISTS promo_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promo_code_id INT NOT NULL,
  customer_id INT NOT NULL,
  order_id INT NOT NULL,
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('page_view', 'order_created', 'signup') NOT NULL,
  page_url VARCHAR(500) DEFAULT NULL,
  customer_id INT DEFAULT NULL,
  session_id VARCHAR(100) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analytics_type (event_type),
  INDEX idx_analytics_created (created_at),
  INDEX idx_analytics_session (session_id)
);
