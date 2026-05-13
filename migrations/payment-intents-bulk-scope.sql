-- Migration: Extend payment_intents.scope ENUM to support bulk_order
-- Date: 2026-05-12
-- Run BEFORE deploying code that writes scope='bulk_order'.
-- Safe to run multiple times on MySQL 8+ (MODIFY COLUMN is idempotent when the value is already present).

USE meenarh_logistics;

ALTER TABLE payment_intents
  MODIFY COLUMN scope ENUM('full_cart', 'single_item', 'bulk_order') NOT NULL;
