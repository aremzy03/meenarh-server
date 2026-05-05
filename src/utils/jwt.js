const jwt = require('jsonwebtoken');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  };
}

module.exports = { signToken, verifyToken, sessionCookieOptions };
