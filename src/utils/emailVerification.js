/**
 * Email verification links are built from API_PUBLIC_URL; transactional mail uses Resend (RESEND_API_KEY + EMAIL_FROM).
 */
function isEmailVerificationFullyConfigured() {
  const apiBase = (process.env.API_PUBLIC_URL || '').trim();
  return !!(apiBase && process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

/** When true, unverified customers can log in but cannot use gated APIs (skipped in dev if email is not configured). */
function isEmailVerificationEnforced() {
  const prod = process.env.NODE_ENV === 'production';
  const configured = isEmailVerificationFullyConfigured();
  return prod || configured;
}

module.exports = {
  isEmailVerificationFullyConfigured,
  isEmailVerificationEnforced,
};
