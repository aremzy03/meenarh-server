const userService = require('../services/user.service');
const { isEmailVerificationEnforced } = require('../utils/emailVerification');

/**
 * Blocks customers until `customers.is_email_verified` is true.
 * Use after authMiddleware on routes that must not run before email verification.
 */
async function requireCustomerEmailVerified(req, res, next) {
  if (!isEmailVerificationEnforced()) {
    return next();
  }
  try {
    const customer = await userService.getCustomerById(req.user.id);
    if (!customer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
        code: 'FORBIDDEN',
      });
    }
    if (!customer.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email to continue. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireCustomerEmailVerified;
