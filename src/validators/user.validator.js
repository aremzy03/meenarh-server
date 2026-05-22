const { z } = require('zod');

const phoneSchema = z
  .string()
  .min(7, 'Valid phone number is required')
  .regex(/^\+?[0-9]{7,15}$/, 'Phone number must be digits and may start with +');

/** Treat missing, null, or blank strings as absent; validate length only when provided. */
const optionalAddressSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().min(5, 'Address must be at least 5 characters').optional()
);

const signupSchema = z
  .object({
    name: z.string().min(2, 'Name is required (minimum 2 characters)'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: phoneSchema,
    default_address: optionalAddressSchema,
  })
  .strict();

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).strict();

const updateProfileSchema = z
  .object({
    phone: phoneSchema.optional(),
    default_address: optionalAddressSchema,
  })
  .strict()
  .refine(
    (data) => data.phone !== undefined || data.default_address !== undefined,
    { message: 'At least one field (phone or default_address) must be provided' }
  );

function validateSignup(req, res, next) {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({
      success: false,
      message: errors[0] || 'Validation failed',
      errors,
    });
  }

  req.body = result.data;
  next();
}

function validateLogin(req, res, next) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({
      success: false,
      message: errors[0] || 'Validation failed',
      errors,
    });
  }

  req.body = result.data;
  next();
}

function validateUpdateProfile(req, res, next) {
  const result = updateProfileSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({
      success: false,
      message: errors[0] || 'Validation failed',
      errors,
    });
  }

  req.body = result.data;
  next();
}

module.exports = { validateSignup, validateLogin, validateUpdateProfile };
