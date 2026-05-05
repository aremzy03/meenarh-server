-- Active: 1771318376114@@localhost@3306@meenarh_logistics
-- Persist selected delivery sub-area on cart items + orders
-- Prerequisite: `delivery_region_areas` table exists (see `migrations/delivery-region-areas.sql`)

USE meenarh_logistics;

ALTER TABLE orders
  ADD COLUMN delivery_region_area_id INT NULL AFTER delivery_region_id,
  ADD INDEX idx_orders_delivery_area (delivery_region_area_id);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_delivery_region_area
    FOREIGN KEY (delivery_region_area_id) REFERENCES delivery_region_areas(id)
    ON DELETE SET NULL;

ALTER TABLE cart_items
  ADD COLUMN delivery_region_area_id INT NULL AFTER delivery_region_id,
  ADD INDEX idx_cart_delivery_area (delivery_region_area_id);

ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_delivery_region_area
    FOREIGN KEY (delivery_region_area_id) REFERENCES delivery_region_areas(id)
    ON DELETE SET NULL;

