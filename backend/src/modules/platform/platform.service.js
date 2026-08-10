const db = require('../../config/db');

async function getSettings() {
  const [rows] = await db.query(
    'SELECT maintenance_mode, maintenance_message, updated_at FROM platform_settings WHERE id = 1'
  );
  return rows[0];
}

async function setMaintenanceMode(enabled, message) {
  const [rows] = await db.query(
    `UPDATE platform_settings SET maintenance_mode = ?, maintenance_message = ?, updated_at = NOW()
     WHERE id = 1 RETURNING maintenance_mode, maintenance_message, updated_at`,
    [enabled, message || null]
  );
  return rows[0];
}

module.exports = { getSettings, setMaintenanceMode };
