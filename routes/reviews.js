const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createReview,
  getReviews,
  getUserReview,
  updateReview,
  deleteReview,
  getReviewStats,
} = require("../controllers/reviewController");

// Public routes
router.get("/products/:productId/reviews", getReviews);
router.get("/products/:productId/reviews/stats", getReviewStats);

// Protected routes (require authentication)
router.post("/products/:productId/reviews", authMiddleware, createReview);
router.get("/products/:productId/reviews/user", authMiddleware, getUserReview);
router.put("/reviews/:id", authMiddleware, updateReview);
router.delete("/reviews/:id", authMiddleware, deleteReview);

module.exports = router;
