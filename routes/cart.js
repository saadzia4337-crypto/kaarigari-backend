const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getCart, addItem, removeItem, updateItemQty } = require("../controllers/cartController");

router.use(authMiddleware);

router.get("/", getCart);
router.post("/items", addItem);
router.delete("/items/:productId", removeItem);
router.patch("/items/:productId", updateItemQty);

module.exports = router;
