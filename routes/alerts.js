const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/alerts - Create new alert
router.post('/', async (req, res) => {
  try {
    console.log('ALERTS ENDPOINT HIT - Request received');
    const { orderId, message, type, senderId, recipientId } = req.body;
    
    // Validate required fields
    if (!orderId || !message || !type || !senderId || !recipientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, message, type, senderId, recipientId'
      });
    }
    
    // Create alert in database
    const alert = await Alert.create({
      recipient: recipientId,
      sender: senderId,
      orderId,
      message,
      type
    });
    
    // Populate details for response
    await alert.populate(['sender', 'recipient', 'orderId']);
    
    console.log('Alert created successfully:', alert);
    
    res.status(200).json({
      success: true,
      message: 'Alert created successfully',
      data: alert
    });
  } catch (error) {
    console.error('Alert processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/alerts - Get user's alerts
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('GET ALERTS - User:', req.user.id);
    
    const alerts = await Alert.find({ recipient: req.user.id })
      .sort({ timestamp: -1 });
    
    console.log(`Found ${alerts.length} alerts for user ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      message: 'Alerts retrieved successfully',
      data: alerts
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/alerts/count - Get unread alert count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    console.log(`GET ALERT COUNT - User: ${req.user.userId}`);
    
    const unreadCount = await Alert.countDocuments({
      recipient: req.user.userId,
      read: false
    });
    
    console.log('Unread count calculated:', unreadCount);
    console.log('Sending response:', { success: true, data: unreadCount });
    
    res.status(200).json({
      success: true,
      data: unreadCount
    });
  } catch (error) {
    console.error('GET ALERT COUNT ERROR:', error);
    console.log('Sending error response:', { success: false, error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/alerts/:id/read - Mark alert as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    // Check if user owns this alert
    if (alert.recipient._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to mark this alert as read'
      });
    }
    
    alert.read = true;
    await alert.save();
    
    res.status(200).json({
      success: true,
      message: 'Alert marked as read',
      data: alert
    });
  } catch (error) {
    console.error('Failed to mark alert as read:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/alerts/:id - Delete alert
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DELETE ALERT - Alert ID:', req.params.id, 'User:', req.user.id);
    
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    // Check if user owns this alert
    if (alert.recipient._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this alert'
      });
    }
    
    await Alert.findByIdAndDelete(req.params.id);
    
    console.log('Alert deleted successfully:', req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
