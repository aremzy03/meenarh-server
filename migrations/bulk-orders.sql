-- Migration: Add bulk orders support
-- Date: 2026-05-12
USE meenarh_logistics;

-- Parent bulk shipment: one row per bulk order, shared sender + default pickup address
CREATE TABLE IF NOT EXISTS bulk_orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  tracking_number VARCHAR(24) NOT NULL UNIQUE,
  sender_name     VARCHAR(100) NOT NULL,
  sender_phone    VARCHAR(20) NOT NULL,
  -- Shared default pickup address (street-level); each item may override this
  pickup_address  VARCHAR(255) NOT NULL,
  -- Sum of all line prices
  price           DECIMAL(10, 2) NOT NULL DEFAULT 0,
  -- Only Order Created is stored on the parent; per-item lifecycle lives on bulk_order_items
  status          ENUM('Order Created') NOT NULL DEFAULT 'Order Created',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- One row per destination / line within a bulk order
CREATE TABLE IF NOT EXISTS bulk_order_items (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  bulk_order_id           INT NOT NULL,
  sort_index              INT NOT NULL DEFAULT 0,
  -- Per-item pickup: region required; address override optional (NULL => use parent pickup_address)
  pickup_region_id        INT NOT NULL,
  pickup_address          VARCHAR(255) DEFAULT NULL,
  -- Delivery destination
  delivery_region_id      INT NOT NULL,
  delivery_region_area_id INT DEFAULT NULL,
  delivery_address        VARCHAR(255) NOT NULL,
  -- Receiver
  receiver_name           VARCHAR(100) NOT NULL,
  receiver_phone          VARCHAR(20) NOT NULL,
  -- Package details (optional)
  package_description     VARCHAR(255) DEFAULT NULL,
  item_value              DECIMAL(10, 2) DEFAULT NULL,
  quantity                INT DEFAULT 1,
  is_fragile              BOOLEAN DEFAULT FALSE,
  -- Rate snapshot at time of creation
  price_ngn               DECIMAL(10, 2) NOT NULL,
  eta_min_hours           INT DEFAULT NULL,
  eta_max_hours           INT DEFAULT NULL,
  eta_label               VARCHAR(50) DEFAULT NULL,
  -- Per-item lifecycle: Pending (just created) → Picked Up → In Transit → Out for Delivery → Delivered
  status                  ENUM('Pending', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered')
                            NOT NULL DEFAULT 'Pending',
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_order_id)           REFERENCES bulk_orders(id)              ON DELETE CASCADE,
  FOREIGN KEY (pickup_region_id)        REFERENCES pickup_regions(id)           ON DELETE RESTRICT,
  FOREIGN KEY (delivery_region_id)      REFERENCES delivery_regions(id)         ON DELETE RESTRICT,
  FOREIGN KEY (delivery_region_area_id) REFERENCES delivery_region_areas(id)    ON DELETE SET NULL
);

-- Audit trail for bulk parent status changes (Order Created, Cancelled if added later)
CREATE TABLE IF NOT EXISTS bulk_order_events (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  bulk_order_id   INT NOT NULL,
  status          VARCHAR(50) NOT NULL,
  note            VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_order_id) REFERENCES bulk_orders(id) ON DELETE CASCADE
);

-- Audit trail for per-item status changes (Pending → Picked Up → … → Delivered)
CREATE TABLE IF NOT EXISTS bulk_order_item_events (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  bulk_order_item_id  INT NOT NULL,
  status              VARCHAR(50) NOT NULL,
  note                VARCHAR(255) DEFAULT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_order_item_id) REFERENCES bulk_order_items(id) ON DELETE CASCADE
);

-- Indexes for common queries
-- Note: MySQL does not support CREATE INDEX IF NOT EXISTS.
-- These are safe to run on a fresh schema; skip any that already exist.
CREATE INDEX idx_bulk_orders_user        ON bulk_orders(user_id);
CREATE INDEX idx_bulk_items_bulk         ON bulk_order_items(bulk_order_id);
CREATE INDEX idx_bulk_items_status       ON bulk_order_items(status);
CREATE INDEX idx_bulk_events_bulk        ON bulk_order_events(bulk_order_id);
CREATE INDEX idx_bulk_item_events_item   ON bulk_order_item_events(bulk_order_item_id);
