const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  let token = null;
  let source = null;

  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
    source = 'header';
  } else if (req.cookies?.meenarh_admin_token) {
    token = req.cookies.meenarh_admin_token;
    source = 'cookie';
  } else if (req.cookies?.meenarh_customer_token) {
    token = req.cookies.meenarh_customer_token;
    source = 'cookie';
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    req.authSource = source;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;
