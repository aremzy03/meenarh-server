-- Migration: grouped bulk drafts in cart + checkout-level promo usage
-- Date: 2026-05-13

USE meenarh_logistics;

CREATE TABLE IF NOT EXISTS cart_bulk_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sender_name VARCHAR(100) DEFAULT NULL,
  sender_phone VARCHAR(20) DEFAULT NULL,
  pickup_address VARCHAR(255) DEFAULT NULL,
  estimated_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  item_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_bulk_entries_user
    FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_cart_bulk_entries_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS cart_bulk_entry_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_bulk_entry_id INT NOT NULL,
  sort_index INT NOT NULL,
  pickup_region_id INT NOT NULL,
  pickup_address VARCHAR(255) DEFAULT NULL,
  delivery_region_id INT NOT NULL,
  delivery_region_area_id INT DEFAULT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  receiver_name VARCHAR(100) NOT NULL,
  receiver_phone VARCHAR(20) NOT NULL,
  package_description VARCHAR(255) DEFAULT NULL,
  item_value DECIMAL(10, 2) DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 1,
  is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_price DECIMAL(10, 2) NOT NULL,
  eta_min_hours INT DEFAULT NULL,
  eta_max_hours INT DEFAULT NULL,
  eta_label VARCHAR(80) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_bulk_entry_items_entry
    FOREIGN KEY (cart_bulk_entry_id) REFERENCES cart_bulk_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_bulk_entry_items_pickup_region
    FOREIGN KEY (pickup_region_id) REFERENCES pickup_regions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cart_bulk_entry_items_delivery_region
    FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cart_bulk_entry_items_delivery_region_area
    FOREIGN KEY (delivery_region_area_id) REFERENCES delivery_region_areas(id) ON DELETE SET NULL,
  UNIQUE KEY uq_cart_bulk_entry_item_sort (cart_bulk_entry_id, sort_index),
  INDEX idx_cart_bulk_entry_items_entry (cart_bulk_entry_id)
);

ALTER TABLE promo_usage
  ADD COLUMN payment_intent_id INT NULL AFTER customer_id;

ALTER TABLE promo_usage
  MODIFY COLUMN order_id INT NULL;

ALTER TABLE promo_usage
  ADD CONSTRAINT fk_promo_usage_payment_intent
    FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL;

ALTER TABLE promo_usage
  ADD INDEX idx_promo_usage_payment_intent (payment_intent_id);
