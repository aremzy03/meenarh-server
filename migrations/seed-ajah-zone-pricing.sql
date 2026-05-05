-- Seed Ajah Zone pricing (pickup region) from company price list CSV
-- Source: `meenarh-pricelist/Ajah Price Lists.csv`
--
-- Prerequisites:
-- - `migrations/region-pricing.sql` (pickup_regions, delivery_regions, region_rates)
-- - `migrations/delivery-region-areas.sql` (delivery_region_areas)

USE meenarh_logistics;

-- 1) Pickup region
INSERT INTO pickup_regions (name, slug, sort_order, is_active)
SELECT 'Ajah Zone', 'ajah-zone', 0, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pickup_regions WHERE name = 'Ajah Zone');

-- 2) Delivery regions (names as in the CSV)
INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Lekki Phase 1 Axis', NULL, 10, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Lekki Phase 1 Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'VI Axis', NULL, 20, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'VI Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ajah Axis', NULL, 30, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ajah Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Awoyaya Axis', NULL, 40, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Awoyaya Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Surulere Axis', NULL, 50, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Surulere Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Yaba Axis', NULL, 60, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Yaba Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ikeja Axis', NULL, 70, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ikeja Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ojota Axis', NULL, 80, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ojota Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Mushin Axis', NULL, 90, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Mushin Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Agege Axis', NULL, 100, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Agege Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Lagos Island Axis', NULL, 110, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Lagos Island Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Igando Axis', NULL, 120, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Igando Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Amuwo Axis', NULL, 130, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Amuwo Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Gbagada Axis', NULL, 140, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Gbagada Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ojodu Axis', NULL, 150, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ojodu Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ojo Axis', NULL, 160, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ojo Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Festac Axis', NULL, 170, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Festac Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ikorodu Garage', NULL, 180, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ikorodu Garage');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Igbogbo Axis', NULL, 190, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Igbogbo Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Ogolonto Axis', NULL, 200, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Ogolonto Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Owode', NULL, 210, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Owode');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Gberigbe Axis', NULL, 220, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Gberigbe Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Itamaga Axis', NULL, 230, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Itamaga Axis');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Sango Otta', NULL, 240, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Sango Otta');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Badagry', NULL, 250, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Badagry');

INSERT INTO delivery_regions (name, description, sort_order, is_active)
SELECT 'Agbara', NULL, 260, TRUE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM delivery_regions WHERE name = 'Agbara');

-- 3) Region rates (flat price + normalized ETA)
-- ETA normalization rules:
-- - Same day => 8–12 hours
-- - 24 hours => 24–24 hours
-- - 48 hours => 48–48 hours
-- - 24/48 hours => 24–48 hours

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 2500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Lekki Phase 1 Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'VI Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 2500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ajah Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Awoyaya Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Surulere Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Yaba Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ikeja Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ojota Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Mushin Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Agege Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Lagos Island Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 5000.00, 24, 24, '24 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Igando Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4000.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Amuwo Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 3500.00, 8, 12, 'Same day', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Gbagada Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 5000.00, 24, 48, '24/48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ojodu Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 6000.00, 24, 48, '24/48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ojo Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 4500.00, 24, 48, '24/48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Festac Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 7000.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ikorodu Garage'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 7500.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Igbogbo Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 6500.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Ogolonto Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 6000.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Owode'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 8500.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Gberigbe Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 7500.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Itamaga Axis'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 7500.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Sango Otta'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 9000.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Badagry'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

INSERT INTO region_rates (pickup_region_id, delivery_region_id, price_ngn, eta_min_hours, eta_max_hours, eta_label, is_active)
SELECT p.id, d.id, 8000.00, 48, 48, '48 hours', TRUE
FROM pickup_regions p JOIN delivery_regions d
WHERE p.name = 'Ajah Zone' AND d.name = 'Agbara'
ON DUPLICATE KEY UPDATE
  price_ngn = VALUES(price_ngn),
  eta_min_hours = VALUES(eta_min_hours),
  eta_max_hours = VALUES(eta_max_hours),
  eta_label = VALUES(eta_label),
  is_active = VALUES(is_active);

-- 4) Areas within delivery regions
-- Note: values are trimmed from the CSV; empty areas are skipped.

-- Lekki Phase 1 Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Chevron', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ikate', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'ikota', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agungi', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Jakande', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Osapa', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ilasan', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Marwa', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ajiran', TRUE FROM delivery_regions d WHERE d.name = 'Lekki Phase 1 Axis';

-- VI Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ikoyi', TRUE FROM delivery_regions d WHERE d.name = 'VI Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Banana Island', TRUE FROM delivery_regions d WHERE d.name = 'VI Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Oniru', TRUE FROM delivery_regions d WHERE d.name = 'VI Axis';

-- Ajah Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'VGC', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abraham Adesanya', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ado', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Langbasa', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Badore', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'General paint', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Thomas Estate', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Crown estate', TRUE FROM delivery_regions d WHERE d.name = 'Ajah Axis';

-- Awoyaya Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Sangotedo', TRUE FROM delivery_regions d WHERE d.name = 'Awoyaya Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Shoprite(Novare mall axis)', TRUE FROM delivery_regions d WHERE d.name = 'Awoyaya Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Monastery road', TRUE FROM delivery_regions d WHERE d.name = 'Awoyaya Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Lakowe', TRUE FROM delivery_regions d WHERE d.name = 'Awoyaya Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Bogije', TRUE FROM delivery_regions d WHERE d.name = 'Awoyaya Axis';

-- Surulere Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Aguda', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ijesha', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Bode Thomas', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Adeniran Ogunsanya', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Lawanson', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Itire', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ojuelegba', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Stadium', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Alaka', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Eric Moore', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Adelabu', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Masha', TRUE FROM delivery_regions d WHERE d.name = 'Surulere Axis';

-- Yaba Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Sabo', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Alagomeji', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Akoka', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Unilag', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Jibowu', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Onike', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abule oja', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ebute metta (East and west)', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Fadeyi', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Shomolu', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Bariga', TRUE FROM delivery_regions d WHERE d.name = 'Yaba Axis';

-- Ikeja Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ikeja GRA', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Opebi', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Allen', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Alausa', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Maryland', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Magodo', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Omole Phase 1 and 2', TRUE FROM delivery_regions d WHERE d.name = 'Ikeja Axis';

-- Ojota Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ketu', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Mile 12', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ojota', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Alapeere', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ikosi', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Kosofe', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ogudu', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Obanikoro', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Anthony', TRUE FROM delivery_regions d WHERE d.name = 'Ojota Axis';

-- Mushin Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Mushin', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Idi-oro', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ilasamaja', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Isolo', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ajao estate', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Mafoluku', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Oshodi', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Jakande', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ilupeju', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ire-akari', TRUE FROM delivery_regions d WHERE d.name = 'Mushin Axis';

-- Agege Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Egbeda', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Idimu', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ikotun', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Isheri', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abule-egba', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ipaja', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Dopemu', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ogba', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ijaiye', TRUE FROM delivery_regions d WHERE d.name = 'Agege Axis';

-- Lagos Island Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'TBS', TRUE FROM delivery_regions d WHERE d.name = 'Lagos Island Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Obalende', TRUE FROM delivery_regions d WHERE d.name = 'Lagos Island Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Idumota', TRUE FROM delivery_regions d WHERE d.name = 'Lagos Island Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'CMS', TRUE FROM delivery_regions d WHERE d.name = 'Lagos Island Axis';

-- Igando Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Igando', TRUE FROM delivery_regions d WHERE d.name = 'Igando Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ayobo', TRUE FROM delivery_regions d WHERE d.name = 'Igando Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ijegun', TRUE FROM delivery_regions d WHERE d.name = 'Igando Axis';

-- Amuwo Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ago palace', TRUE FROM delivery_regions d WHERE d.name = 'Amuwo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Okota', TRUE FROM delivery_regions d WHERE d.name = 'Amuwo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Satellite town', TRUE FROM delivery_regions d WHERE d.name = 'Amuwo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abule-ado', TRUE FROM delivery_regions d WHERE d.name = 'Amuwo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abule-osun', TRUE FROM delivery_regions d WHERE d.name = 'Amuwo Axis';

-- Gbagada Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Gbagada', TRUE FROM delivery_regions d WHERE d.name = 'Gbagada Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Palmgroove', TRUE FROM delivery_regions d WHERE d.name = 'Gbagada Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Onipanu', TRUE FROM delivery_regions d WHERE d.name = 'Gbagada Axis';

-- Ojodu Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Opic', TRUE FROM delivery_regions d WHERE d.name = 'Ojodu Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ojodu berger', TRUE FROM delivery_regions d WHERE d.name = 'Ojodu Axis';

-- Ojo Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ojo', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Lasu gate', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Iba', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Iyana school', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Post service estate', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'First gate', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ipaye', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agboroko', TRUE FROM delivery_regions d WHERE d.name = 'Ojo Axis';

-- Festac Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Apapa', TRUE FROM delivery_regions d WHERE d.name = 'Festac Axis';

-- Ikorodu Garage areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Sabo', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ita-oluwo', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ebute ikorodu', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agric', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Aruna', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Benson', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Odogunyan', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'First gate', TRUE FROM delivery_regions d WHERE d.name = 'Ikorodu Garage';

-- Igbogbo Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Igbogbo', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ibeshe', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Igbe', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Oreta', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Isawo', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agbede', TRUE FROM delivery_regions d WHERE d.name = 'Igbogbo Axis';

-- Ogolonto Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Majidun', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Owutu', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Itowolo', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Eyita', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Parafa', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ipakodo', TRUE FROM delivery_regions d WHERE d.name = 'Ogolonto Axis';

-- Gberigbe Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Gberigbe', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agura', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'offin', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Baiyeku', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Imota', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Maya', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Adamo', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Agunfoye', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Odo-nla', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Olorunda', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Igbopa', TRUE FROM delivery_regions d WHERE d.name = 'Gberigbe Axis';

-- Itamaga Axis areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Itamaga', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ijede', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Elepe', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Eleshin', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Omitoro', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Gbaja', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Abule ijede', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Okeletu', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Gbodu', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Eruwen', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Ota-ona', TRUE FROM delivery_regions d WHERE d.name = 'Itamaga Axis';

-- Badagry areas
INSERT IGNORE INTO delivery_region_areas (delivery_region_id, name, is_active)
SELECT d.id, 'Badagry town', TRUE FROM delivery_regions d WHERE d.name = 'Badagry';

