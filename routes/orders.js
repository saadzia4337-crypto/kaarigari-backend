const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Order alerts endpoint - placed at the beginning
router.post('/alerts', async (req, res) => {
  try {
    console.log('ALERTS ENDPOINT HIT - Request received');
    const { orderId, message, type, timestamp } = req.body;
    
    // Store alert in database (you could also save to a collection)
    console.log('Order alert received:', { orderId, message, type, timestamp });
    
    // For now, just return success (in a real app, you might save to database)
    res.status(200).json({ 
      success: true,
      message: 'Alert processed successfully',
      alert: {
        orderId,
        message,
        type,
        timestamp
      }
    });
  } catch (error) {
    console.error('Alert processing error:', error);
    res.status(500).json({ message: 'Failed to process alert' });
  }
});

// Get orders where authenticated user is the buyer (for seller purchases)
router.get('/my-purchases', authMiddleware, async (req, res) => {
  try {
    console.log('GET /orders/my-purchases - User:', req.user.email, 'Role:', req.user.role);
    console.log('GET /orders/my-purchases - Query params:', req.query);
    
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query - always filter by authenticated user as buyer
    let query = { user: req.user.id };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    console.log('My purchases query:', JSON.stringify(query, null, 2));
    
    // Fetch orders with populated data (handled by pre-find middleware)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    console.log(`Found ${orders.length} purchases out of ${total} total`);
    
    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my purchases error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      user: req.user?.email,
      role: req.user?.role
    });
    res.status(500).json({ message: 'Failed to fetch purchases' });
  }
});

// Get all orders (no admin restrictions)
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('GET /orders - User:', req.user.email, 'Role:', req.user.role);
    console.log('GET /orders - Query params:', req.query);
    
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    let query = {};
    
    if (req.user.role === 'buyer') {
      // Buyers can only see their own orders
      query.user = req.user.id;
    } else if (req.user.role === 'seller') {
      // Sellers can only see orders containing their products
      query['items.seller'] = req.user.id;
    } else if (req.user.role === 'admin') {
      // Admins can see their own orders (when they act as buyers)
      query.user = req.user.id;
    }
    // All users can see orders based on their role
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    console.log('Orders query:', JSON.stringify(query, null, 2));
    
    // Fetch orders with populated data (handled by pre-find middleware)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Debug: Check if population worked
    console.log('Sample order data:', orders.length > 0 ? {
      _id: orders[0]._id,
      orderNumber: orders[0].orderNumber,
      user: orders[0].user,
      items: orders[0].items?.length || 0,
      firstItem: orders[0].items?.[0] ? {
        product: orders[0].items[0].product?.title || 'No product title',
        productId: orders[0].items[0].product?._id || 'No product ID',
        productImages: orders[0].items[0].product?.images || 'No images',
        imageCount: orders[0].items[0].product?.images?.length || 0,
        seller: orders[0].items[0].seller?.firstName || 'No seller name',
        price: orders[0].items[0].price,
        quantity: orders[0].items[0].quantity
      } : 'No items'
    } : 'No orders found');
    
    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    console.log(`Found ${orders.length} orders out of ${total} total`);
    
    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      user: req.user?.email,
      role: req.user?.role
    });
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get single order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('GET /orders/:id - Order ID:', req.params.id);
    console.log('GET /orders/:id - User:', req.user.email, 'Role:', req.user.role);
    
    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'title images price')
      .populate('items.seller', 'firstName lastName email')
      .populate('shippingAddress');
    
    console.log('Order found:', !!order);
    
    if (!order) {
      console.log('Order not found in database');
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if user is admin or order owner
    const isOwner = order.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Check if user is a seller with products in this order
    const isSellerWithProducts = req.user.role === 'seller' && 
      order.items.some(item => {
        const sellerId = item.seller.toString();
        // Handle both ObjectId string and stringified object
        let cleanSellerId = sellerId;
        
        if (sellerId.includes('{')) {
          try {
            // Parse the stringified object to extract the _id
            const parsed = JSON.parse(sellerId);
            cleanSellerId = parsed._id;
          } catch (error) {
            console.log('Failed to parse sellerId, using original:', sellerId);
            // If parsing fails, try to extract ObjectId from string
            const objectIdMatch = sellerId.match(/ObjectId\('([^']+)'\)/);
            if (objectIdMatch) {
              return objectIdMatch[1] === req.user.id;
            }
          }
        }
        return sellerId === req.user.id;
      });
    
    console.log('Access check details:', {
      userId: req.user.id,
      userRole: req.user.role,
      orderUserId: order.user._id.toString(),
      isOwner,
      isSellerWithProducts
    });
    
    // Allow access if user is order owner or seller with products in order (no admin required)
    if (isOwner || isSellerWithProducts) {
      console.log('Access granted - user has permission');
    } else {
      console.log('Access denied - user does not have permission');
      return res.status(403).json({ message: 'Access denied' });
    }
    
    console.log('Returning order with populated data');
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// Create new order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, shippingAddress, notes } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }
    
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address required' });
    }
    
    // Validate and calculate total
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      console.log(`Looking for product with ID: ${item.productId}`);
      const product = await Product.findById(item.productId);
      console.log(`Product found:`, product ? 'YES' : 'NO');
      if (product) {
        console.log(`Product details:`, {
          title: product.title,
          quantity: product.quantity,
          seller: product.seller,
          price: product.price
        });
      }
      
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }
      
      // Check stock availability
      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.title}. Available: ${product.quantity}` 
        });
      }
      
      // Get product price (could be overridden if price changed)
      const price = item.price || product.price;
      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        product: item.productId,
        quantity: item.quantity,
        price: price,
        size: item.size || null,
        customSize: item.customSize || null,
        seller: product.seller
      });
      
      // Update product quantity
      product.quantity -= item.quantity;
      await product.save();
    }
    
    // Create order
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      shippingAddress,
      totalAmount,
      notes: notes || ''
    });
    
    await order.save();
    
    // Clear user's cart after successful order
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { $set: { items: [] } }
    );
    
    // Populate order details for response
    await order.populate([
      { path: 'items.product', select: 'title images price quantity sellerName' },
      { path: 'items.seller', select: 'firstName lastName email' },
      { path: 'user', select: 'firstName lastName email' }
    ]);
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Update order status (authenticated users)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check access permissions
    const isOwner = order.user._id.toString() === req.user.id;
    const isSeller = req.user.role === 'seller' && 
      order.items.some(item => {
        const sellerId = item.seller.toString();
        if (sellerId.includes('{')) {
          try {
            const parsed = JSON.parse(sellerId);
            return parsed._id === req.user.id;
          } catch (error) {
            const objectIdMatch = sellerId.match(/ObjectId\('([^']+)'\)/);
            if (objectIdMatch) {
              return objectIdMatch[1] === req.user.id;
            }
          }
        }
        return sellerId === req.user.id;
      });
    
    // Allow owners, sellers (with products), buyers (cancel only), and admins to update status
    if (!isOwner && !isSeller && req.user.role !== 'admin' && !(req.user.role === 'buyer' && status === 'cancelled')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update status
    order.status = status;
    
    // Set delivery date if order is delivered
    if (status === 'delivered') {
      order.deliveryDate = new Date();
    }
    
    // Handle cancellation
    if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancelReason = notes || 'Cancelled by admin';
      
      // Restore product quantities
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }
    
    // Add admin notes if provided
    if (notes) {
      order.notes = order.notes ? `${order.notes}\n\nAdmin: ${notes}` : `Admin: ${notes}`;
    }
    
    await order.save();
    
    // Populate order details for response
    await order.populate([
      { path: 'items.product', select: 'title images price quantity sellerName' },
      { path: 'items.seller', select: 'firstName lastName email' },
      { path: 'user', select: 'firstName lastName email' }
    ]);
    
    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Update order status for sellers (seller can update status for orders with their products)
router.put('/:id/seller-status', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!['pending', 'confirmed', 'processing', 'shipped', 'delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status for seller update' });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Allow sellers and admins to update status
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied - only sellers and admins can update status' });
    }
    
    // Allow admins to bypass seller product check
    let hasSellerProducts = true;
    if (req.user.role === 'seller') {
      hasSellerProducts = order.items.some(item => {
        const sellerId = item.seller.toString();
        console.log('Seller status update check:', {
          userId: req.user.id,
          orderItemSeller: sellerId,
          isDirectMatch: sellerId === req.user.id,
          isStringified: typeof sellerId === 'string' && sellerId.includes('{'),
          parsedId: typeof sellerId === 'string' && sellerId.includes('{') ? JSON.parse(sellerId)._id : null
        });
        
        // Try multiple approaches to match seller ID
        if (sellerId === req.user.id) {
          console.log('Direct match found for status update');
          return true;
        }
        
        if (typeof sellerId === 'string' && sellerId.includes('{')) {
          try {
            const parsed = JSON.parse(sellerId);
            if (parsed._id === req.user.id) {
              console.log('JSON parse match found for status update');
              return true;
            }
          } catch (error) {
            console.log('JSON parse failed for status update, trying regex');
            // Try regex extraction
            const objectIdMatch = sellerId.match(/ObjectId\('([^']+)'\)/);
            if (objectIdMatch && objectIdMatch[1] === req.user.id) {
              console.log('Regex match found for status update');
              return true;
            }
          }
        }
        
        console.log('No match found for status update');
        return false;
      });
    } else if (req.user.role === 'admin') {
      console.log('Admin bypassing seller product check');
      hasSellerProducts = true;
    }
    
    if (!hasSellerProducts) {
      return res.status(403).json({ message: 'Access denied - no seller products in order' });
    }
    
    // Update status
    order.status = status;
    
    // Set delivery date if order is delivered
    if (status === 'delivered') {
      order.deliveryDate = new Date();
    }
    
    // Add seller notes if provided
    if (notes) {
      order.notes = order.notes ? `${order.notes}\n\nSeller: ${notes}` : `Seller: ${notes}`;
    }
    
    await order.save();
    
    // Populate order details for response
    await order.populate([
      { path: 'items.product', select: 'title images price quantity sellerName' },
      { path: 'items.seller', select: 'firstName lastName email' },
      { path: 'user', select: 'firstName lastName email' }
    ]);
    
    res.json(order);
  } catch (error) {
    console.error('Update seller order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Cancel order (user only, only pending orders)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if user owns the order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Can only cancel pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Can only cancel pending orders' });
    }
    
    // Update order
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';
    
    // Restore product quantities
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }
    
    await order.save();
    
    // Populate order details for response
    await order.populate([
      { path: 'items.product', select: 'title images price quantity sellerName' },
      { path: 'items.seller', select: 'firstName lastName email' },
      { path: 'user', select: 'firstName lastName email' }
    ]);
    
    res.json(order);
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

// Get orders for a specific seller
router.get('/seller/:sellerId', authMiddleware, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Check if user is the seller or admin
    if (req.user.role !== 'admin' && req.user.id !== sellerId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const filter = {};
    
    // Filter by status if provided
    if (status) {
      filter.status = status;
    }
    
    // Find orders that contain items from this seller
    const orders = await Order.find({
      'items.seller': sellerId,
      ...filter
    })
    .sort({ orderDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    const total = await Order.countDocuments({
      'items.seller': sellerId,
      ...filter
    });
    
    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({ message: 'Failed to fetch seller orders' });
  }
});

// Get order statistics (admin only)
router.get('/stats/summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      statusStats: stats,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Failed to fetch order statistics' });
  }
});

module.exports = router;
