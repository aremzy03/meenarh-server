const bulkOrderService = require('../services/bulkOrder.service');
const { sendTemplateMessage } = require('../services/whatsapp.service');
const { sendOrderStatusUpdateEmail } = require('../services/email.service');
const pool = require('../config/db');

// ─── Customer ────────────────────────────────────────────────────────────────

async function getUserBulkOrders(req, res, next) {
  try {
    const bulks = await bulkOrderService.getBulkOrdersByUserId(req.user.id);
    res.json({ success: true, data: bulks });
  } catch (err) {
    next(err);
  }
}

async function getUserBulkOrderDetail(req, res, next) {
  try {
    const bulk = await bulkOrderService.getBulkOrderById(Number(req.params.id));
    if (!bulk || bulk.user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Bulk order not found' });
    }
    res.json({ success: true, data: bulk });
  } catch (err) {
    next(err);
  }
}

async function createBulkOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await bulkOrderService.createBulkOrder(req.body, userId);

    // Best-effort notifications via shared helper
    bulkOrderService.notifyBulkOrderPlaced(userId, {
      trackingNumber: result.trackingNumber,
      totalPrice: result.totalPrice,
    });

    res.status(201).json({
      success: true,
      message: 'Bulk order created successfully',
      data: {
        tracking_number: result.trackingNumber,
        total_price: result.totalPrice,
        item_count: result.itemCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function getAllBulkOrders(_req, res, next) {
  try {
    const bulks = await bulkOrderService.getAllBulkOrders();
    res.json({ success: true, data: bulks });
  } catch (err) {
    next(err);
  }
}

async function getBulkOrderDetail(req, res, next) {
  try {
    const { id } = req.params;
    const bulk = await bulkOrderService.getBulkOrderById(Number(id));
    if (!bulk) {
      return res.status(404).json({ success: false, message: 'Bulk order not found' });
    }
    res.json({ success: true, data: bulk });
  } catch (err) {
    next(err);
  }
}

async function updateBulkItemStatus(req, res, next) {
  try {
    const { bulkId, itemId } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    await bulkOrderService.updateBulkItemStatus(Number(bulkId), Number(itemId), status, note);

    // Best-effort item-status notification
    try {
      const [[bulk]] = await pool.execute(
        'SELECT b.tracking_number, b.user_id FROM bulk_orders b WHERE b.id = ?',
        [bulkId]
      );
      const [[item]] = await pool.execute(
        'SELECT receiver_name FROM bulk_order_items WHERE id = ?',
        [itemId]
      );

      if (bulk?.user_id) {
        const [[customer]] = await pool.execute(
          'SELECT email, phone, name FROM customers WHERE id = ?',
          [bulk.user_id]
        );

        if (customer?.phone) {
          sendTemplateMessage({
            to: customer.phone,
            templateName: 'order_status_update',
            languageCode: 'en',
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customer.name || 'there' },
                  { type: 'text', text: `${bulk.tracking_number} (${item?.receiver_name || 'item'})` },
                  { type: 'text', text: status },
                  { type: 'text', text: note || '' },
                ],
              },
            ],
          });
        }

        if (customer?.email) {
          sendOrderStatusUpdateEmail({
            to: customer.email,
            name: customer.name,
            trackingNumber: `${bulk.tracking_number} — ${item?.receiver_name || 'item'}`,
            status,
            note: note || '',
          });
        }
      }
    } catch (notifyErr) {
      // eslint-disable-next-line no-console
      console.error('[BulkOrderController] Failed to send item status notifications', notifyErr);
    }

    res.json({ success: true, message: 'Item status updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBulkOrder,
  getUserBulkOrders,
  getUserBulkOrderDetail,
  getAllBulkOrders,
  getBulkOrderDetail,
  updateBulkItemStatus,
};
