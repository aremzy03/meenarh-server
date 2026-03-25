const { z } = require('zod');

const createPromoSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').max(50),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive('Discount value must be positive'),
  min_order_value: z.number().positive().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

const updatePromoSchema = z.object({
  code: z.string().min(3).max(50).optional(),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
  discount_value: z.number().positive().optional(),
  min_order_value: z.number().positive().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

const validateCodeSchema = z.object({
  code: z.string().min(1, 'Promo code is required'),
  order_total: z.number().positive('Order total must be positive'),
});

function validateCreatePromo(req, res, next) {
  const result = createPromoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.errors[0].message });
  }
  req.body = result.data;
  next();
}

function validateUpdatePromo(req, res, next) {
  const result = updatePromoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.errors[0].message });
  }
  req.body = result.data;
  next();
}

function validatePromoCode(req, res, next) {
  const result = validateCodeSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.errors[0].message });
  }
  req.body = result.data;
  next();
}

module.exports = { validateCreatePromo, validateUpdatePromo, validatePromoCode };
