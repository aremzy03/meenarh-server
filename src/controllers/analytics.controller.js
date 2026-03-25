const analyticsService = require('../services/analytics.service');

async function trackEvent(req, res, next) {
  try {
    const { event_type, page_url, session_id, metadata } = req.body;

    if (!event_type) {
      return res.status(400).json({ success: false, message: 'event_type is required' });
    }

    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    await analyticsService.trackEvent({
      event_type,
      page_url,
      customer_id: null,
      session_id,
      metadata,
      ip_address,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getOverview(req, res, next) {
  try {
    const { start_date, end_date } = req.query;

    const end = end_date ? new Date(end_date) : new Date();
    const start = start_date ? new Date(start_date) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const overview = await analyticsService.getOverview(start, end);
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
}

async function getLocations(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const locations = await analyticsService.getLocationStats(limit);
    res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
}

async function getTrends(req, res, next) {
  try {
    const { start_date, end_date } = req.query;

    const end = end_date ? new Date(end_date) : new Date();
    const start = start_date ? new Date(start_date) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trends = await analyticsService.getTrends(start, end);
    res.json({ success: true, data: trends });
  } catch (err) {
    next(err);
  }
}

module.exports = { trackEvent, getOverview, getLocations, getTrends };
