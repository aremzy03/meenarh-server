-- Remove phone OTP verification (WhatsApp Cloud API no longer used).
-- Run once per environment after deploying code that no longer references these objects.
-- Compatible with MySQL 5.7+ (no DROP INDEX/COLUMN IF EXISTS).

DROP TABLE IF EXISTS phone_verifications;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'customers'
    AND index_name = 'idx_customers_is_phone_verified'
);
SET @drop_idx_sql = IF(
  @idx_exists > 0,
  'ALTER TABLE customers DROP INDEX idx_customers_is_phone_verified',
  'SELECT 1'
);
PREPARE drop_idx_stmt FROM @drop_idx_sql;
EXECUTE drop_idx_stmt;
DEALLOCATE PREPARE drop_idx_stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'customers'
    AND column_name = 'is_phone_verified'
);
SET @drop_col_sql = IF(
  @col_exists > 0,
  'ALTER TABLE customers DROP COLUMN is_phone_verified',
  'SELECT 1'
);
PREPARE drop_col_stmt FROM @drop_col_sql;
EXECUTE drop_col_stmt;
DEALLOCATE PREPARE drop_col_stmt;
