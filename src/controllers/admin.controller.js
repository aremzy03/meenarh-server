const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt');
const orderService = require('../services/order.service');

const VALID_STATUSES = ['Order Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const [users] = await pool.execute('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: { name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getOrders(_req, res, next) {
  try {
    const orders = await orderService.getAllOrders();
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Verify order exists
    const [orders] = await pool.execute('SELECT id FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await orderService.updateOrderStatus(id, status, note);

    res.json({ success: true, message: 'Order status updated' });
  } catch (err) {
    next(err);
  }
}

async function listCustomers(_req, res, next) {
  try {
    const [customers] = await pool.execute(`
      SELECT 
        c.id, 
        c.name, 
        c.email, 
        c.phone, 
        c.default_address,
        c.created_at,
        COUNT(o.id) as order_count
      FROM customers c
      LEFT JOIN orders o ON c.id = o.user_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

async function createAdminUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    // Validate role
    if (role && !['admin', 'staff'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "admin" or "staff"',
      });
    }

    // Check if email already exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role || 'staff']
    );

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: result.insertId,
        name,
        email,
        role: role || 'staff',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, getOrders, updateOrderStatus, listCustomers, createAdminUser };
