const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().min(2, 'Name is required (minimum 2 characters)'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(7, 'Valid phone number is required').optional(),
  default_address: z.string().min(5, 'Address must be at least 5 characters').optional(),
}).strict();

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).strict();

const updateProfileSchema = z.object({
  phone: z.string().min(7, 'Valid phone number is required').optional(),
  default_address: z.string().min(5, 'Address must be at least 5 characters').optional(),
}).strict().refine(
  (data) => data.phone !== undefined || data.default_address !== undefined,
  { message: 'At least one field (phone or default_address) must be provided' }
);

function validateSignup(req, res, next) {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

function validateLogin(req, res, next) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

function validateUpdateProfile(req, res, next) {
  const result = updateProfileSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

module.exports = { validateSignup, validateLogin, validateUpdateProfile };
