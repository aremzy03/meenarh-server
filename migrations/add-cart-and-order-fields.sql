-- Migration: Add cart functionality and enhanced order fields
-- Date: 2026-02-17

USE meenarh_logistics;

-- Add new fields to orders table
ALTER TABLE orders
  ADD COLUMN item_value DECIMAL(10, 2) DEFAULT NULL AFTER package_description,
  ADD COLUMN quantity INT DEFAULT 1 AFTER item_value,
  ADD COLUMN is_fragile BOOLEAN DEFAULT FALSE AFTER quantity;

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sender_name VARCHAR(100),
  sender_phone VARCHAR(20),
  pickup_address VARCHAR(255),
  receiver_name VARCHAR(100) NOT NULL,
  receiver_phone VARCHAR(20) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  package_description VARCHAR(255),
  item_value DECIMAL(10, 2),
  quantity INT DEFAULT 1,
  is_fragile BOOLEAN DEFAULT FALSE,
  zone_id INT,
  distance_km DECIMAL(10, 2),
  estimated_price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);
