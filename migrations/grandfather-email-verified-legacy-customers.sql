-- One-time: when enabling mandatory email verification, existing customers have is_email_verified = 0
-- and would be unable to log in. Run this ONCE in each environment after deploying the enforcement
-- and BEFORE you expect new unverified signups, or set a created_at cutoff instead of the blanket update.
--
-- Review your data first. To only trust accounts created before a cutover instant:
--   UPDATE customers SET is_email_verified = 1
--   WHERE is_email_verified = 0 AND created_at < '2026-05-11 00:00:00';
--
-- To grandfather everyone already in the table at migration time (typical small rollout):
UPDATE customers SET is_email_verified = 1 WHERE is_email_verified = 0;
