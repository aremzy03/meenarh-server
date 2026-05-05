const { z } = require('zod');

const deliveriesQuerySchema = z.object({
  pickup_region_id: z.coerce.number().int().positive(),
});

const quoteQuerySchema = z.object({
  pickup_region_id: z.coerce.number().int().positive(),
  delivery_region_id: z.coerce.number().int().positive(),
});

const deliveryAreasQuerySchema = z.object({
  delivery_region_id: z.coerce.number().int().positive(),
});

function validateDeliveriesQuery(req, res, next) {
  const result = deliveriesQuerySchema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Invalid query', errors });
  }
  req.regionQuery = result.data;
  next();
}

function validateDeliveryAreasQuery(req, res, next) {
  const result = deliveryAreasQuerySchema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Invalid query', errors });
  }
  req.deliveryAreasQuery = result.data;
  next();
}

function validateQuoteQuery(req, res, next) {
  const result = quoteQuerySchema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Invalid query', errors });
  }
  req.quoteQuery = result.data;
  next();
}

module.exports = { validateDeliveriesQuery, validateDeliveryAreasQuery, validateQuoteQuery };
