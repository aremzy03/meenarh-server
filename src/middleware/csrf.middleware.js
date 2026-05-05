const crypto = require('crypto');

function isUnsafeMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function ensureCsrfCookie(req, res, next) {
  const existing = req.cookies?.csrf_token;
  if (existing) return next();

  const token = crypto.randomBytes(32).toString('hex');
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('csrf_token', token, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
  return next();
}

/**
 * Double-submit CSRF protection.
 * Only enforced when the request is authenticated via cookies (not Authorization header).
 */
function requireCsrfIfCookieAuth(req, res, next) {
  if (!isUnsafeMethod(req.method)) return next();
  if (req.authSource !== 'cookie') return next();

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || String(headerToken) !== String(cookieToken)) {
    return res.status(403).json({ success: false, message: 'CSRF validation failed' });
  }

  return next();
}

module.exports = { ensureCsrfCookie, requireCsrfIfCookieAuth };

