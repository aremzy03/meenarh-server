function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || req.user.kind !== 'admin' || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = roleMiddleware;
