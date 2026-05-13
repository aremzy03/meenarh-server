/**
 * Generate a tracking number for a bulk order.
 * Format: MN-B-<YEAR>-<4-digit zero-padded ID>
 * Example: MN-B-2026-0001
 *
 * The "B" prefix distinguishes bulk orders from single orders (MN-2026-XXXX)
 * so the /track endpoint can branch without ambiguity.
 */
function generateBulkTracking(bulkOrderId) {
  const year = new Date().getFullYear();
  const padded = String(bulkOrderId).padStart(4, '0');
  return `MN-B-${year}-${padded}`;
}

module.exports = generateBulkTracking;
