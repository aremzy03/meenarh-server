const settingsService = require('../services/settings.service');

async function getSettings(_req, res, next) {
  try {
    const settings = await settingsService.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided' });
    }

    const updated = await settingsService.updateSettings(settings);
    res.json({ success: true, message: 'Settings updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateSettings };
