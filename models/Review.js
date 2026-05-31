const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: function(v) {
          return Number.isInteger(v) && v >= 1 && v <= 5;
        },
        message: "Rating must be an integer between 1 and 5"
      }
    },
    comment: {
      type: String,
      maxlength: 500,
      trim: true,
      default: ""
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index for efficient queries
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // One review per user per product

// Static method to calculate average rating for a product
reviewSchema.statics.calculateAverageRating = async function(productId) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const defaultStats = {
    averageRating: 0,
    reviewCount: 0
  };

  const result = stats[0] || defaultStats;
  
  // Update the product with new rating stats
  await mongoose.model('Product').findByIdAndUpdate(productId, {
    averageRating: Math.round(result.averageRating * 10) / 10, // Round to 1 decimal place
    reviewCount: result.reviewCount
  }, { new: true });

  return result;
};

// Post-save middleware to update product ratings
reviewSchema.post('save', async function() {
  await this.constructor.calculateAverageRating(this.product);
});

// Post-remove middleware to update product ratings
reviewSchema.post('remove', async function() {
  await this.constructor.calculateAverageRating(this.product);
});

module.exports = mongoose.model("Review", reviewSchema);
