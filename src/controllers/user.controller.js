const bcrypt = require('bcrypt');
const userService = require('../services/user.service');
const orderService = require('../services/order.service');
const { signToken } = require('../utils/jwt');

async function signup(req, res, next) {
  try {
    const { name, email, password, phone, default_address } = req.body;

    // Check if email already exists
    const existing = await userService.getCustomerByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Create customer
    const customer = await userService.createCustomer({
      name,
      email,
      password,
      phone,
      default_address,
    });

    // Generate JWT
    const token = signToken({ id: customer.id, email: customer.email, type: 'customer' });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          default_address: customer.default_address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Get customer by email
    const customer = await userService.getCustomerByEmail(email);
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Compare password
    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = signToken({ id: customer.id, email: customer.email, type: 'customer' });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          default_address: customer.default_address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const customer = await userService.getCustomerById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { phone, default_address } = req.body;

    const updated = await userService.updateCustomerProfile(req.user.id, {
      phone,
      default_address,
    });

    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderHistory(req, res, next) {
  try {
    const orders = await orderService.getOrdersByUserId(req.user.id);

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, getProfile, updateProfile, getOrderHistory };
