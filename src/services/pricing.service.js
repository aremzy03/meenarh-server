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

module.exports = { calculatePrice };
