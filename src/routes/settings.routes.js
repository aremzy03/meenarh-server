const { Router } = require('express');
const settingsController = require('../controllers/settings.controller');

// Public route (mounted at /api/settings)
const publicRouter = Router();
publicRouter.get('/', settingsController.getSettings);

// Admin routes (mounted under /api/admin/settings, auth applied by parent)
const adminRouter = Router();
adminRouter.get('/', settingsController.getSettings);
adminRouter.put('/', settingsController.updateSettings);

module.exports = { publicRouter, adminRouter };
