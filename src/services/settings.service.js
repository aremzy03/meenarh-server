const pool = require('../config/db');

async function getAllSettings() {
  const [rows] = await pool.execute('SELECT setting_key, setting_value FROM company_settings');
  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
  }
  return settings;
}

async function updateSettings(settingsObj) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const [key, value] of Object.entries(settingsObj)) {
      await conn.execute(
        `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, value]
      );
    }

    await conn.commit();
    return getAllSettings();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getAllSettings, updateSettings };
