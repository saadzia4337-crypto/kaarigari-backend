const express = require("express");
const router = express.Router();
const {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "tryOnOverlay", maxCount: 1 },
  ]),
  createProduct
);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.put(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "tryOnOverlay", maxCount: 1 },
  ]),
  updateProduct
);
router.delete("/:id", authMiddleware, deleteProduct);

module.exports = router;
