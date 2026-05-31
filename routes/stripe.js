const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createPaymentIntent, 
  confirmPayment, 
  createRefund, 
  getPublishableKey 
} = require('../services/stripeService');

// GET /api/stripe/config - Get Stripe publishable key
router.get('/config', (req, res) => {
  try {
    const publishableKey = getPublishableKey();
    res.json({
      success: true,
      publishableKey: publishableKey
    });
  } catch (error) {
    console.error('Stripe config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Stripe configuration'
    });
  }
});

// POST /api/stripe/create-payment-intent - Create payment intent for order
router.post('/create-payment-intent', authMiddleware, async (req, res) => {
  try {
    const { amount, currency = 'usd', orderId } = req.body;
    
    if (!amount || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Amount and orderId are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    const paymentIntent = await createPaymentIntent(
      amount,
      currency,
      orderId,
      req.user.userId
    );

    console.log(`Payment intent created for order ${orderId}, amount: ${amount} ${currency}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// POST /api/stripe/confirm-payment - Confirm payment status
router.post('/confirm-payment', authMiddleware, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    const payment = await confirmPayment(paymentIntentId);

    res.json({
      success: true,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm payment'
    });
  }
});

// POST /api/stripe/refund - Create refund for payment
router.post('/refund', authMiddleware, async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    const refund = await createRefund(paymentIntentId, amount);

    console.log(`Refund created for payment intent ${paymentIntentId}, amount: ${refund.amount}`);

    res.json({
      success: true,
      refundId: refund.refundId,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason
    });
  } catch (error) {
    console.error('Create refund error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create refund'
    });
  }
});

// POST /api/stripe/webhook - Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    console.error('No Stripe signature found in webhook request');
    return res.status(400).json({ message: 'No signature provided' });
  }

  try {
    const event = await require('../services/stripeService').handleWebhook(
      signature,
      req.body,
      webhookSecret
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_succeeded':
        // Update order status to paid
        await updateOrderPaymentStatus(
          event.data.orderId,
          event.data.userId,
          'paid',
          event.data.paymentIntentId
        );
        break;

      case 'payment_failed':
        // Update order status to payment failed
        await updateOrderPaymentStatus(
          event.data.orderId,
          event.data.userId,
          'payment_failed',
          event.data.paymentIntentId,
          event.data.lastPaymentError
        );
        break;

      case 'payment_canceled':
        // Update order status to payment canceled
        await updateOrderPaymentStatus(
          event.data.orderId,
          event.data.userId,
          'payment_canceled',
          event.data.paymentIntentId
        );
        break;

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * Helper function to update order payment status
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {string} status - Payment status
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {Object} errorDetails - Payment error details (optional)
 */
async function updateOrderPaymentStatus(orderId, userId, status, paymentIntentId, errorDetails = null) {
  try {
    const Order = require('../models/Order');
    
    const updateData = {
      paymentStatus: status,
      paymentIntentId: paymentIntentId,
      updatedAt: new Date()
    };

    if (errorDetails) {
      updateData.paymentError = errorDetails;
    }

    if (status === 'paid') {
      updateData.status = 'confirmed';
      updateData.paidAt = new Date();
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, userId: userId },
      updateData,
      { new: true }
    );

    if (order) {
      console.log(`Order ${orderId} payment status updated to: ${status}`);
      
      // You can add additional actions here like:
      // - Send confirmation email
      // - Send notification to seller
      // - Update inventory
      // - Create shipping order
    } else {
      console.error(`Order ${orderId} not found for user ${userId}`);
    }
  } catch (error) {
    console.error('Error updating order payment status:', error);
  }
}

module.exports = router;
