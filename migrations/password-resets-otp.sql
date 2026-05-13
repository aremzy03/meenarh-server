-- OTP-based password resets: brute-force mitigation + resend throttle support.
ALTER TABLE password_resets
  ADD COLUMN attempts INT NOT NULL DEFAULT 0 AFTER used,
  ADD COLUMN last_sent_at DATETIME NULL AFTER attempts;

CREATE INDEX idx_password_resets_user_active
  ON password_resets (user_id, used, expires_at);
