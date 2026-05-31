const express = require("express");
const router = express.Router();
const {
  listBySeller,
  getBySellerAndCategory,
  create,
  update,
  remove,
} = require("../controllers/sizeChartController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", listBySeller);
router.get("/by-seller-category", getBySellerAndCategory);
router.post("/", authMiddleware, create);
router.patch("/:id", authMiddleware, update);
router.delete("/:id", authMiddleware, remove);

module.exports = router;
