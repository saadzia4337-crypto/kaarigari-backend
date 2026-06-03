const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  size: {
    type: String,
    required: false
  },
  customSize: {
    chest: { type: String, required: false },
    waist: { type: String, required: false },
    length: { type: String, required: false },
    shoulders: { type: String, required: false },
    sleeves: { type: String, required: false },
    fabric: { type: String, required: false },
    color: { type: String, required: false },
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  postalCode: {
    type: String,
    required: false,
    trim: true
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  deliveryDate: {
    type: Date,
    required: false
  },
  notes: {
    type: String,
    trim: true,
    required: false
  },
  cancelledAt: {
    type: Date,
    required: false
  },
  cancelReason: {
    type: String,
    trim: true,
    required: false
  }
}, {
  timestamps: true
});

// Generate unique order number before saving
orderSchema.pre('save', async function() {
  console.log('Pre-save middleware called for order');
  console.log('isNew:', this.isNew);
  console.log('orderNumber exists:', !!this.orderNumber);
  
  if (this.isNew && !this.orderNumber) {
    console.log('Generating order number...');
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get the count of orders for today to generate a sequential number
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    try {
      const orderCount = await this.constructor.countDocuments({
        orderDate: { $gte: startOfDay, $lte: endOfDay }
      });
      
      const sequence = String(orderCount + 1).padStart(3, '0');
      this.orderNumber = `ORD${year}${month}${day}${sequence}`;
      console.log('Generated order number:', this.orderNumber);
    } catch (error) {
      console.error('Error generating order number:', error);
      throw error;
    }
  }
});

// Populate product and seller details when fetching orders
orderSchema.pre(/^find/, function() {
  console.log('Find middleware called for orders');
  this.populate({
    path: 'items.product',
    select: 'title images price'
  }).populate({
    path: 'items.seller',
    select: 'firstName lastName email'
  }).populate({
    path: 'user',
    select: 'firstName lastName email'
  });
});

module.exports = mongoose.model('Order', orderSchema);
