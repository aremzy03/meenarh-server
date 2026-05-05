-- Evolve phone_verifications to support OTP verification codes.
-- Existing rows (link tokens) can remain; application logic will use the latest unused, unexpired row.

ALTER TABLE phone_verifications
  ADD COLUMN attempts INT NOT NULL DEFAULT 0 AFTER used,
  ADD COLUMN last_sent_at DATETIME NULL AFTER attempts;

-- Helpful composite index for fetching the latest active OTP for a user
CREATE INDEX idx_phone_verifications_user_active
  ON phone_verifications (user_id, used, expires_at);

