const { z } = require('zod');

const bulkOrderItemSchema = z.object({
  // Per-item pickup zone (required); street address override optional
  pickup_region_id:        z.number().int().positive('pickup_region_id is required for each item'),
  pickup_address:          z.string().min(5).optional(),
  // Delivery
  delivery_region_id:      z.number().int().positive('delivery_region_id is required for each item'),
  delivery_region_area_id: z.number().int().positive().optional(),
  delivery_address:        z.string().min(5, 'Delivery address is required'),
  // Receiver
  receiver_name:           z.string().min(2, 'Receiver name is required'),
  receiver_phone:          z.string().min(7, 'Valid receiver phone is required'),
  // Package details (optional)
  package_description:     z.string().optional(),
  item_value:              z.number().positive().optional(),
  quantity:                z.number().int().positive().optional(),
  is_fragile:              z.boolean().optional(),
});

const createBulkOrderSchema = z.object({
  // Shared sender / default pickup (all optional — falls back to customer profile)
  sender_name:    z.string().min(2).optional(),
  sender_phone:   z.string().min(7).optional(),
  pickup_address: z.string().min(5).optional(),
  // Must have at least 2 items to qualify as a bulk order
  items: z.array(bulkOrderItemSchema).min(2, 'A bulk order requires at least 2 items'),
}).strict();

function validateCreateBulkOrder(req, res, next) {
  const result = createBulkOrderSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((i) => {
      const path = i.path.length ? `[${i.path.join('.')}] ` : '';
      return `${path}${i.message}`;
    });
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = result.data;
  next();
}

module.exports = { validateCreateBulkOrder, createBulkOrderSchema };
