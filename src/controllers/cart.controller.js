const cartService = require('../services/cart.service');

async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await cartService.addToCart(req.body, userId);
    
    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: {
        id: result.id,
        estimated_price: result.estimated_price,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getCart(req, res, next) {
  try {
    const userId = req.user.id;
    const items = await cartService.getCartItems(userId);
    
    res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
}

async function updateCartItem(req, res, next) {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id, 10);
    
    const result = await cartService.updateCartItem(itemId, req.body, userId);
    
    res.json({
      success: true,
      message: 'Cart item updated',
      data: {
        estimated_price: result.estimated_price,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function removeCartItem(req, res, next) {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id, 10);
    
    const deleted = await cartService.removeCartItem(itemId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (err) {
    next(err);
  }
}

async function clearCart(req, res, next) {
  try {
    const userId = req.user.id;
    await cartService.clearCart(userId);
    
    res.json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const userId = req.user.id;
    const orders = await cartService.checkout(userId);
    
    res.json({
      success: true,
      message: 'Orders created successfully',
      data: {
        orders: orders.map(order => ({
          tracking_number: order.trackingNumber,
          price: order.price,
        })),
        total_orders: orders.length,
        total_price: orders.reduce((sum, order) => sum + order.price, 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function checkoutSingleItem(req, res, next) {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id, 10);
    
    const order = await cartService.checkoutSingleItem(itemId, userId);
    
    res.json({
      success: true,
      message: 'Order created successfully',
      data: {
        orders: [{
          tracking_number: order.trackingNumber,
          price: order.price,
        }],
        total_orders: 1,
        total_price: order.price,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  checkout,
  checkoutSingleItem,
};
