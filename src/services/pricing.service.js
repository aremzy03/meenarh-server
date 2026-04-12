const pool = require('../config/db');

/**
 * Calculate delivery price.
 * @param {Object} params
 * @param {number} params.zoneBasePrice - Base price for the zone
 * @param {number} params.perKmRate - Rate per kilometre
 * @param {number} params.distanceKm - Distance in kilometres
 * @returns {number} Calculated price rounded to 2 decimal places
 */
function calculatePrice({ zoneBasePrice, perKmRate, distanceKm }) {
  const total = zoneBasePrice + perKmRate * distanceKm;
  return Math.round(total * 100) / 100;
}

/** Legacy distance-based quote from `zones` row */
async function calculatePriceFromZone(zoneId, distanceKm) {
  const zid = Number(zoneId);
  const dist = Number(distanceKm);
  if (!Number.isInteger(zid) || zid < 1 || !Number.isFinite(dist) || dist <= 0) return null;

  const [zones] = await pool.execute('SELECT base_price, per_km_rate FROM zones WHERE id = ?', [zid]);
  if (zones.length === 0) return null;

  return calculatePrice({
    zoneBasePrice: parseFloat(zones[0].base_price),
    perKmRate: parseFloat(zones[0].per_km_rate),
    distanceKm: dist,
  });
}

module.exports = { calculatePrice, calculatePriceFromZone };
