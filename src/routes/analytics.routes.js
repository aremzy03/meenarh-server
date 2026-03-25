const { Router } = require('express');
const analyticsController = require('../controllers/analytics.controller');

// Public tracking endpoint (mounted at /api/analytics)
const publicRouter = Router();
publicRouter.post('/track', analyticsController.trackEvent);

// Admin analytics routes (mounted under /api/admin/analytics, auth applied by parent)
const adminRouter = Router();
adminRouter.get('/overview', analyticsController.getOverview);
adminRouter.get('/locations', analyticsController.getLocations);
adminRouter.get('/trends', analyticsController.getTrends);

module.exports = { publicRouter, adminRouter };
