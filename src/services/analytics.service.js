const pool = require('../config/db');

async function trackEvent({ event_type, page_url, customer_id, session_id, metadata, ip_address }) {
  await pool.execute(
    `INSERT INTO analytics_events (event_type, page_url, customer_id, session_id, metadata, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [event_type, page_url || null, customer_id || null, session_id || null, JSON.stringify(metadata || null), ip_address || null]
  );
}

async function getOverview(startDate, endDate) {
  const params = [startDate, endDate];

  const [[visitors]] = await pool.execute(
    `SELECT COUNT(DISTINCT session_id) as total_visitors
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at BETWEEN ? AND ?`,
    params
  );

  const [[orders]] = await pool.execute(
    `SELECT COUNT(*) as total_orders, COALESCE(SUM(price), 0) as total_revenue
     FROM orders
     WHERE created_at BETWEEN ? AND ?`,
    params
  );

  const [[signups]] = await pool.execute(
    `SELECT COUNT(*) as total_signups
     FROM customers
     WHERE created_at BETWEEN ? AND ?`,
    params
  );

  const totalVisitors = visitors.total_visitors || 0;
  const totalOrders = orders.total_orders || 0;
  const conversionRate = totalVisitors > 0 ? ((totalOrders / totalVisitors) * 100).toFixed(2) : 0;

  return {
    total_visitors: totalVisitors,
    total_orders: totalOrders,
    total_revenue: parseFloat(orders.total_revenue) || 0,
    total_signups: signups.total_signups || 0,
    conversion_rate: parseFloat(conversionRate),
  };
}

async function getLocationStats(limit = 10) {
  // LIMIT cannot be a prepared statement placeholder in all MySQL2 versions
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));

  const [pickupLocations] = await pool.query(
    `SELECT
        COALESCE(pr.name, 'Unknown pickup area') AS location,
        COUNT(*) AS request_count
     FROM orders o
     LEFT JOIN pickup_regions pr ON pr.id = o.pickup_region_id
     GROUP BY location
     ORDER BY request_count DESC
     LIMIT ${safeLimit}`
  );

  const [deliveryLocations] = await pool.query(
    `SELECT
        COALESCE(dr.name, 'Unknown delivery area') AS location,
        COUNT(*) AS request_count
     FROM orders o
     LEFT JOIN delivery_regions dr ON dr.id = o.delivery_region_id
     GROUP BY location
     ORDER BY request_count DESC
     LIMIT ${safeLimit}`
  );

  return { pickup_locations: pickupLocations, delivery_locations: deliveryLocations };
}

async function getTrends(startDate, endDate) {
  const [visitorTrends] = await pool.execute(
    `SELECT DATE(created_at) as date, COUNT(DISTINCT session_id) as visitors
     FROM analytics_events
     WHERE event_type = 'page_view' AND created_at BETWEEN ? AND ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  const [orderTrends] = await pool.execute(
    `SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(price), 0) as revenue
     FROM orders
     WHERE created_at BETWEEN ? AND ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  return { visitors: visitorTrends, orders: orderTrends };
}

module.exports = { trackEvent, getOverview, getLocationStats, getTrends };
