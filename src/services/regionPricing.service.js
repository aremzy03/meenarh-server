const pool = require('../config/db');

function formatEtaDisplay(row) {
  if (!row) return null;
  if (row.eta_label && String(row.eta_label).trim()) return row.eta_label.trim();
  const min = row.eta_min_hours;
  const max = row.eta_max_hours;
  if (min != null && max != null) {
    if (min === max) return `${min} hrs`;
    return `${min}–${max} hrs`;
  }
  return null;
}

async function listActivePickups() {
  const [rows] = await pool.execute(
    `SELECT id, name, slug, sort_order
     FROM pickup_regions
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, name ASC`
  );
  return rows;
}

/** Delivery regions that have at least one active rate from the given pickup */
async function listDeliveriesForPickup(pickupRegionId) {
  const id = Number(pickupRegionId);
  if (!Number.isInteger(id) || id < 1) return [];

  const [rows] = await pool.execute(
    `SELECT DISTINCT d.id, d.name, d.description, d.sort_order
     FROM delivery_regions d
     INNER JOIN region_rates r ON r.delivery_region_id = d.id
       AND r.pickup_region_id = ?
       AND r.is_active = TRUE
     WHERE d.is_active = TRUE
     ORDER BY d.sort_order ASC, d.name ASC`,
    [id]
  );
  return rows;
}

async function getActiveRate(pickupRegionId, deliveryRegionId) {
  const p = Number(pickupRegionId);
  const d = Number(deliveryRegionId);
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(d) || d < 1) return null;

  const [rows] = await pool.execute(
    `SELECT r.id AS rate_id,
            r.price_ngn,
            r.eta_min_hours,
            r.eta_max_hours,
            r.eta_label,
            pr.name AS pickup_name,
            dr.name AS delivery_name
     FROM region_rates r
     INNER JOIN pickup_regions pr ON pr.id = r.pickup_region_id AND pr.is_active = TRUE
     INNER JOIN delivery_regions dr ON dr.id = r.delivery_region_id AND dr.is_active = TRUE
     WHERE r.pickup_region_id = ?
       AND r.delivery_region_id = ?
       AND r.is_active = TRUE
     LIMIT 1`,
    [p, d]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    rate_id: row.rate_id,
    price_ngn: parseFloat(row.price_ngn),
    eta_min_hours: row.eta_min_hours,
    eta_max_hours: row.eta_max_hours,
    eta_label: row.eta_label,
    eta_display: formatEtaDisplay(row),
    pickup_name: row.pickup_name,
    delivery_name: row.delivery_name,
  };
}

async function listActiveDeliveryAreas(deliveryRegionId) {
  const id = Number(deliveryRegionId);
  if (!Number.isInteger(id) || id < 1) return [];

  const [rows] = await pool.execute(
    `SELECT id, name
     FROM delivery_region_areas
     WHERE delivery_region_id = ?
       AND is_active = TRUE
     ORDER BY name ASC`,
    [id]
  );
  return rows;
}

async function listAllPickupsForAdmin() {
  const [rows] = await pool.execute(
    `SELECT id, name, slug, sort_order, is_active, created_at, updated_at
     FROM pickup_regions
     ORDER BY sort_order ASC, name ASC`
  );
  return rows;
}

async function listAllDeliveriesForAdmin() {
  const [rows] = await pool.execute(
    `SELECT id, name, description, sort_order, is_active, created_at, updated_at
     FROM delivery_regions
     ORDER BY sort_order ASC, name ASC`
  );
  return rows;
}

async function listRatesForAdmin(pickupRegionId = null) {
  if (pickupRegionId != null && pickupRegionId !== '') {
    const id = Number(pickupRegionId);
    if (!Number.isInteger(id) || id < 1) return [];
    const [rows] = await pool.execute(
      `SELECT r.id,
              r.pickup_region_id,
              r.delivery_region_id,
              r.price_ngn,
              r.eta_min_hours,
              r.eta_max_hours,
              r.eta_label,
              r.is_active,
              pr.name AS pickup_name,
              dr.name AS delivery_name,
              r.created_at,
              r.updated_at
       FROM region_rates r
       JOIN pickup_regions pr ON pr.id = r.pickup_region_id
       JOIN delivery_regions dr ON dr.id = r.delivery_region_id
       WHERE r.pickup_region_id = ?
       ORDER BY dr.sort_order ASC, dr.name ASC`,
      [id]
    );
    return rows;
  }

  const [rows] = await pool.execute(
    `SELECT r.id,
            r.pickup_region_id,
            r.delivery_region_id,
            r.price_ngn,
            r.eta_min_hours,
            r.eta_max_hours,
            r.eta_label,
            r.is_active,
            pr.name AS pickup_name,
            dr.name AS delivery_name,
            r.created_at,
            r.updated_at
     FROM region_rates r
     JOIN pickup_regions pr ON pr.id = r.pickup_region_id
     JOIN delivery_regions dr ON dr.id = r.delivery_region_id
     ORDER BY pr.sort_order ASC, pr.name ASC, dr.sort_order ASC, dr.name ASC`
  );
  return rows;
}

async function createPickup({ name, slug, sort_order, is_active }) {
  const [result] = await pool.execute(
    `INSERT INTO pickup_regions (name, slug, sort_order, is_active) VALUES (?, ?, ?, ?)`,
    [name, slug || null, sort_order ?? 0, is_active !== false]
  );
  return result.insertId;
}

async function updatePickup(id, body) {
  const fields = [];
  const vals = [];
  if (body.name !== undefined) {
    fields.push('name = ?');
    vals.push(body.name);
  }
  if (body.slug !== undefined) {
    fields.push('slug = ?');
    vals.push(body.slug || null);
  }
  if (body.sort_order !== undefined) {
    fields.push('sort_order = ?');
    vals.push(body.sort_order);
  }
  if (body.is_active !== undefined) {
    fields.push('is_active = ?');
    vals.push(body.is_active !== false);
  }
  if (fields.length === 0) return false;
  vals.push(id);
  const [result] = await pool.execute(
    `UPDATE pickup_regions SET ${fields.join(', ')} WHERE id = ?`,
    vals
  );
  return result.affectedRows > 0;
}

async function deletePickup(id) {
  const [result] = await pool.execute('DELETE FROM pickup_regions WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function createDelivery({ name, description, sort_order, is_active }) {
  const [result] = await pool.execute(
    `INSERT INTO delivery_regions (name, description, sort_order, is_active) VALUES (?, ?, ?, ?)`,
    [name, description || null, sort_order ?? 0, is_active !== false]
  );
  return result.insertId;
}

async function updateDelivery(id, body) {
  const fields = [];
  const vals = [];
  if (body.name !== undefined) {
    fields.push('name = ?');
    vals.push(body.name);
  }
  if (body.description !== undefined) {
    fields.push('description = ?');
    vals.push(body.description || null);
  }
  if (body.sort_order !== undefined) {
    fields.push('sort_order = ?');
    vals.push(body.sort_order);
  }
  if (body.is_active !== undefined) {
    fields.push('is_active = ?');
    vals.push(body.is_active !== false);
  }
  if (fields.length === 0) return false;
  vals.push(id);
  const [result] = await pool.execute(
    `UPDATE delivery_regions SET ${fields.join(', ')} WHERE id = ?`,
    vals
  );
  return result.affectedRows > 0;
}

async function deleteDelivery(id) {
  const [result] = await pool.execute('DELETE FROM delivery_regions WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function createRate({
  pickup_region_id,
  delivery_region_id,
  price_ngn,
  eta_min_hours,
  eta_max_hours,
  eta_label,
  is_active,
}) {
  const [result] = await pool.execute(
    `INSERT INTO region_rates (
       pickup_region_id, delivery_region_id, price_ngn,
       eta_min_hours, eta_max_hours, eta_label, is_active
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      pickup_region_id,
      delivery_region_id,
      price_ngn,
      eta_min_hours,
      eta_max_hours,
      eta_label || null,
      is_active !== false,
    ]
  );
  return result.insertId;
}

async function updateRate(id, body) {
  const fields = [];
  const vals = [];
  const map = [
    ['pickup_region_id', body.pickup_region_id],
    ['delivery_region_id', body.delivery_region_id],
    ['price_ngn', body.price_ngn],
    ['eta_min_hours', body.eta_min_hours],
    ['eta_max_hours', body.eta_max_hours],
    ['eta_label', body.eta_label],
    ['is_active', body.is_active],
  ];
  for (const [col, val] of map) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(col === 'is_active' ? val !== false : val);
    }
  }
  if (fields.length === 0) return false;
  vals.push(id);
  const [result] = await pool.execute(
    `UPDATE region_rates SET ${fields.join(', ')} WHERE id = ?`,
    vals
  );
  return result.affectedRows > 0;
}

async function deleteRate(id) {
  const [result] = await pool.execute('DELETE FROM region_rates WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = {
  formatEtaDisplay,
  listActivePickups,
  listDeliveriesForPickup,
  listActiveDeliveryAreas,
  getActiveRate,
  listAllPickupsForAdmin,
  listAllDeliveriesForAdmin,
  listRatesForAdmin,
  createPickup,
  updatePickup,
  deletePickup,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  createRate,
  updateRate,
  deleteRate,
};
