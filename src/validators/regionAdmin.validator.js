const { z } = require('zod');

const pickupBody = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(120).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

const pickupUpdateBody = pickupBody.partial();

const deliveryBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

const deliveryUpdateBody = deliveryBody.partial();

const rateBody = z.object({
  pickup_region_id: z.coerce.number().int().positive(),
  delivery_region_id: z.coerce.number().int().positive(),
  price_ngn: z.coerce.number().positive(),
  eta_min_hours: z.coerce.number().int().min(0).max(240),
  eta_max_hours: z.coerce.number().int().min(0).max(240),
  eta_label: z.string().max(80).optional().nullable(),
  is_active: z.boolean().optional(),
}).refine((d) => d.eta_max_hours >= d.eta_min_hours, {
  message: 'eta_max_hours must be >= eta_min_hours',
  path: ['eta_max_hours'],
});

/** PATCH body — Zod v4 disallows `.partial()` on schemas with `.refine()` */
const rateUpdateBody = z.object({
  pickup_region_id: z.coerce.number().int().positive().optional(),
  delivery_region_id: z.coerce.number().int().positive().optional(),
  price_ngn: z.coerce.number().positive().optional(),
  eta_min_hours: z.coerce.number().int().min(0).max(240).optional(),
  eta_max_hours: z.coerce.number().int().min(0).max(240).optional(),
  eta_label: z.string().max(80).optional().nullable(),
  is_active: z.boolean().optional(),
}).superRefine((d, ctx) => {
  const provided = Object.keys(d).filter((k) => d[k] !== undefined);
  if (provided.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one field is required',
    });
  }
  if (d.eta_min_hours != null && d.eta_max_hours != null && d.eta_max_hours < d.eta_min_hours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'eta_max_hours must be >= eta_min_hours',
      path: ['eta_max_hours'],
    });
  }
});

function parse(schema, source) {
  return schema.safeParse(source);
}

function validateCreatePickup(req, res, next) {
  const r = parse(pickupBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

function validateUpdatePickup(req, res, next) {
  const r = parse(pickupUpdateBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

function validateCreateDelivery(req, res, next) {
  const r = parse(deliveryBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

function validateUpdateDelivery(req, res, next) {
  const r = parse(deliveryUpdateBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

function validateCreateRate(req, res, next) {
  const r = parse(rateBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

function validateUpdateRate(req, res, next) {
  const r = parse(rateUpdateBody, req.body);
  if (!r.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: r.error.issues.map((i) => i.message) });
  }
  req.body = r.data;
  next();
}

module.exports = {
  validateCreatePickup,
  validateUpdatePickup,
  validateCreateDelivery,
  validateUpdateDelivery,
  validateCreateRate,
  validateUpdateRate,
};
