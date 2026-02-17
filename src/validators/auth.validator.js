const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).strict();

const createAdminUserSchema = z.object({
  name: z.string().min(2, 'Name is required (minimum 2 characters)'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'staff'], { errorMap: () => ({ message: 'Role must be "admin" or "staff"' }) }).optional(),
}).strict();

function validateLogin(req, res, next) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

function validateCreateAdminUser(req, res, next) {
  const result = createAdminUserSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

module.exports = { validateLogin, validateCreateAdminUser };
