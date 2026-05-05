-- Update all 48-hour ETAs to 48/72 hours
--
-- This updates existing data in `region_rates`:
-- - eta_min_hours: 48
-- - eta_max_hours: 48  -> 72
-- - eta_label: '48 hours' -> '48/72 hours'
--
-- Safe to re-run: it only targets rows that still look like "48 hours".

USE meenarh_logistics;

UPDATE region_rates
SET
  eta_min_hours = 48,
  eta_max_hours = 72,
  eta_label = '48/72 hours',
  updated_at = CURRENT_TIMESTAMP
WHERE
  eta_min_hours = 48
  AND eta_max_hours = 48
  AND (
    eta_label IS NULL
    OR TRIM(eta_label) = ''
    OR LOWER(TRIM(eta_label)) = '48 hours'
  );

