const { z } = require('zod');

const createOrderSchema = z.object({
  sender_name: z.string().min(2, 'Sender name must be at least 2 characters').optional(),
  sender_phone: z.string().min(7, 'Valid sender phone is required').optional(),
  pickup_address: z.string().min(5, 'Pickup address must be at least 5 characters').optional(),
  receiver_name: z.string().min(2, 'Receiver name is required'),
  receiver_phone: z.string().min(7, 'Valid receiver phone is required'),
  delivery_address: z.string().min(5, 'Delivery address is required'),
  package_description: z.string().optional(),
  item_value: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  is_fragile: z.boolean().optional(),
  zone_id: z.number().int().positive().optional(),
  distance_km: z.number().positive().optional(),
  pickup_region_id: z.number().int().positive().optional(),
  delivery_region_id: z.number().int().positive().optional(),
}).strict().superRefine((data, ctx) => {
  const hasPickup = data.pickup_region_id != null;
  const hasDelivery = data.delivery_region_id != null;
  if (hasPickup !== hasDelivery) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pickup_region_id and delivery_region_id must both be provided',
      path: ['delivery_region_id'],
    });
  }
  const hasRegions = hasPickup && hasDelivery;
  const hasLegacy = data.zone_id != null && data.distance_km != null;
  if (!hasRegions && !hasLegacy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide pickup_region_id and delivery_region_id, or zone_id and distance_km',
      path: ['pickup_region_id'],
    });
  }
});

function validateCreateOrder(req, res, next) {
  const result = createOrderSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

module.exports = { validateCreateOrder };
