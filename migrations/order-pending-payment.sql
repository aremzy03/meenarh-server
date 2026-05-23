-- Pending Payment orders: materialize before Paystack confirms, then transition to Order Created
USE meenarh_logistics;

ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'Pending Payment',
    'Order Created',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered'
  ) NOT NULL DEFAULT 'Order Created';

ALTER TABLE orders
  ADD COLUMN payment_intent_id INT NULL AFTER user_id,
  ADD COLUMN paystack_reference VARCHAR(100) NULL AFTER payment_intent_id,
  ADD INDEX idx_orders_paystack_reference (paystack_reference),
  ADD CONSTRAINT fk_orders_payment_intent
    FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL;

ALTER TABLE bulk_orders
  MODIFY COLUMN status ENUM('Pending Payment', 'Order Created') NOT NULL DEFAULT 'Order Created';

ALTER TABLE bulk_orders
  ADD COLUMN payment_intent_id INT NULL AFTER user_id,
  ADD COLUMN paystack_reference VARCHAR(100) NULL AFTER payment_intent_id,
  ADD INDEX idx_bulk_orders_paystack_reference (paystack_reference),
  ADD CONSTRAINT fk_bulk_orders_payment_intent
    FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL;
