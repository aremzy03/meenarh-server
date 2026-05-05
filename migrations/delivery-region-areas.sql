-- Active: 1771318376114@@localhost@3306@meenarh_logistics
-- Delivery region areas (sub-areas/streets/estates within a delivery region)
-- This supports the "AREAS WITHIN DELIVERY ZONE" column from company price lists.
--
-- Prerequisite: `delivery_regions` table exists (see `migrations/region-pricing.sql`)

USE meenarh_logistics;

CREATE TABLE IF NOT EXISTS delivery_region_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_region_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_delivery_area (delivery_region_id, name),
  FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions(id) ON DELETE CASCADE,
  INDEX idx_area_delivery_active (delivery_region_id, is_active)
);

