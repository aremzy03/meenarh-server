-- Active: 1771318376114@@localhost@3306@meenarh_logistics
-- Region-based flat delivery pricing (pickup hub x delivery zone)
-- Run after existing schema / migrations.

USE meenarh_logistics;

CREATE TABLE IF NOT EXISTS pickup_regions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pickup_active_sort (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS delivery_regions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_delivery_active_sort (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS region_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pickup_region_id INT NOT NULL,
  delivery_region_id INT NOT NULL,
  price_ngn DECIMAL(12, 2) NOT NULL,
  eta_min_hours INT NOT NULL,
  eta_max_hours INT NOT NULL,
  eta_label VARCHAR(80) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pickup_delivery (pickup_region_id, delivery_region_id),
  FOREIGN KEY (pickup_region_id) REFERENCES pickup_regions(id) ON DELETE CASCADE,
  FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions(id) ON DELETE CASCADE,
  INDEX idx_rate_pickup_active (pickup_region_id, is_active)
);

ALTER TABLE orders
  ADD COLUMN pickup_region_id INT NULL AFTER distance_km,
  ADD COLUMN delivery_region_id INT NULL AFTER pickup_region_id,
  ADD COLUMN eta_min_hours INT NULL AFTER delivery_region_id,
  ADD COLUMN eta_max_hours INT NULL AFTER eta_min_hours,
  ADD COLUMN eta_label VARCHAR(80) NULL AFTER eta_max_hours;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_pickup_region FOREIGN KEY (pickup_region_id) REFERENCES pickup_regions(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_delivery_region FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions(id) ON DELETE SET NULL;

ALTER TABLE cart_items
  ADD COLUMN pickup_region_id INT NULL AFTER distance_km,
  ADD COLUMN delivery_region_id INT NULL AFTER pickup_region_id,
  ADD COLUMN eta_min_hours INT NULL AFTER delivery_region_id,
  ADD COLUMN eta_max_hours INT NULL AFTER eta_min_hours,
  ADD COLUMN eta_label VARCHAR(80) NULL AFTER eta_max_hours;

ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_pickup_region FOREIGN KEY (pickup_region_id) REFERENCES pickup_regions(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cart_delivery_region FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions(id) ON DELETE SET NULL;

-- Optional demo seed (only when tables are empty — safe to re-run migration on fresh DB)
INSERT INTO pickup_regions (name, slug, sort_order, is_active)
SELECT 'Sample Pickup Hub', 'sample-pickup', 0, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM pickup_regions);

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Sample Delivery Zone', 'Example zone for testing quotes', 0, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3500.00, 8, 12, 'Same day (8–12 hrs)', TRUE
FROM (SELECT MIN(id) AS id FROM pickup_regions) p
JOIN (SELECT MIN(id) AS id FROM delivery_regions) d
WHERE NOT EXISTS (SELECT 1 FROM region_rates);
