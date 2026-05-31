const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a payment intent for order
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code (default: 'usd')
 * @param {string} orderId - Order ID for metadata
 * @param {string} userId - User ID for metadata
 * @returns {Promise<Object>} Payment intent with client secret
 */
async function createPaymentIntent(amount, currency = 'usd', orderId, userId) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      metadata: {
        orderId: orderId,
        userId: userId,
        integration: 'kaarigari_platform'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
}

/**
 * Confirm payment intent status
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} Payment intent status
 */
async function confirmPayment(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      success: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    console.error('Stripe payment confirmation error:', error);
    throw new Error(`Failed to confirm payment: ${error.message}`);
  }
}

/**
 * Create a refund for a payment
 * @param {string} paymentIntentId - Payment intent ID to refund
 * @param {number} amount - Amount to refund in cents (optional, full refund if not provided)
 * @returns {Promise<Object>} Refund details
 */
async function createRefund(paymentIntentId, amount) {
  try {
    const refundParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount);
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason
    };
  } catch (error) {
    console.error('Stripe refund creation error:', error);
    throw new Error(`Failed to create refund: ${error.message}`);
  }
}

/**
 * Get Stripe publishable key for frontend
 * @returns {string} Publishable key
 */
function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY;
}

/**
 * Webhook handler for Stripe events
 * @param {string} signature - Stripe signature header
 * @param {Buffer} body - Raw request body
 * @param {string} webhookSecret - Stripe webhook secret
 * @returns {Promise<Object>} Processed event
 */
async function handleWebhook(signature, body, webhookSecret) {
  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    console.log('Stripe webhook event received:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        return {
          type: 'payment_succeeded',
          data: {
            paymentIntentId: paymentIntent.id,
            orderId: paymentIntent.metadata.orderId,
            userId: paymentIntent.metadata.userId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
          }
        };

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        return {
          type: 'payment_failed',
          data: {
            paymentIntentId: failedPayment.id,
            orderId: failedPayment.metadata.orderId,
            userId: failedPayment.metadata.userId,
            lastPaymentError: failedPayment.last_payment_error
          }
        };

      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        console.log('Payment canceled:', canceledPayment.id);
        return {
          type: 'payment_canceled',
          data: {
            paymentIntentId: canceledPayment.id,
            orderId: canceledPayment.metadata.orderId,
            userId: canceledPayment.metadata.userId
          }
        };

      default:
        console.log(`Unhandled event type: ${event.type}`);
        return {
          type: 'unhandled',
          data: event
        };
    }
  } catch (error) {
    console.error('Stripe webhook error:', error);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

module.exports = {
  createPaymentIntent,
  confirmPayment,
  createRefund,
  getPublishableKey,
  handleWebhook
};
