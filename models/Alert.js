const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['order_placed', 'order_cancelled', 'status_update'],
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Populate user and order details when fetching alerts
alertSchema.pre(/^find/, function() {
  this.populate([
    {
      path: 'sender',
      select: 'firstName lastName email'
    },
    {
      path: 'recipient',
      select: 'firstName lastName email'
    },
    {
      path: 'orderId',
      select: 'orderNumber status totalAmount'
    }
  ]);
});

module.exports = mongoose.model('Alert', alertSchema);
