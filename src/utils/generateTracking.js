/**
 * Generate a tracking number from an order ID.
 * Format: MN-<YEAR>-<4-digit zero-padded ID>
 * Example: MN-2026-0001
 */
function generateTracking(orderId) {
  const year = new Date().getFullYear();
  const padded = String(orderId).padStart(4, '0');
  return `MN-${year}-${padded}`;
}

module.exports = generateTracking;
