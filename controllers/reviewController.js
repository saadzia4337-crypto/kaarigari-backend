const Review = require("../models/Review");
const Product = require("../models/Product");
const mongoose = require("mongoose");

// Create a review for a product
exports.createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.productId;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: productId
    });

    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    // Create review
    const review = await Review.create({
      rating,
      comment: comment || "",
      user: req.user._id,
      product: productId
    });

    // Populate review with user and product info
    const populatedReview = await Review.findById(review._id)
      .populate("user", "firstName lastName profilePic")
      .populate("product", "title");

    res.status(201).json(populatedReview);
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all reviews for a product (with pagination)
exports.getReviews = async (req, res) => {
  try {
    const productId = req.params.productId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || "newest"; // newest, oldest, highest, lowest

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Determine sort order
    let sortOptions = {};
    switch (sort) {
      case "oldest":
        sortOptions = { createdAt: 1 };
        break;
      case "highest":
        sortOptions = { rating: -1, createdAt: -1 };
        break;
      case "lowest":
        sortOptions = { rating: 1, createdAt: -1 };
        break;
      case "newest":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const skip = (page - 1) * limit;

    const reviews = await Review.find({ product: productId })
      .populate("user", "firstName lastName profilePic")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalReviews = await Review.countDocuments({ product: productId });

    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNext: page < Math.ceil(totalReviews / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get current user's review for a product
exports.getUserReview = async (req, res) => {
  try {
    const productId = req.params.productId;

    const review = await Review.findOne({
      user: req.user._id,
      product: productId
    }).populate("user", "firstName lastName profilePic");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);
  } catch (error) {
    console.error("Get user review error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update a review (only by the author)
exports.updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const reviewId = req.params.id;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user is the author
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only update your own review" });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Update review
    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true, runValidators: true }
    ).populate("user", "firstName lastName profilePic");

    res.json(updatedReview);
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a review (only by the author or admin)
exports.deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user is the author or admin
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own review" });
    }

    await Review.findByIdAndDelete(reviewId);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get review statistics for a product
exports.getReviewStats = async (req, res) => {
  try {
    const productId = req.params.productId;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Initialize distribution with all ratings
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingDistribution.forEach(item => {
      distribution[item._id] = item.count;
    });

    res.json({
      averageRating: product.averageRating || 0,
      reviewCount: product.reviewCount || 0,
      distribution
    });
  } catch (error) {
    console.error("Get review stats error:", error);
    res.status(500).json({ message: error.message });
  }
};
