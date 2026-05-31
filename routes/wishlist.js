const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getWishlist, addItem, removeItem } = require("../controllers/wishlistController");

router.use(authMiddleware);

router.get("/", getWishlist);
router.post("/items", addItem);
router.delete("/items/:productId", removeItem);

module.exports = router;
