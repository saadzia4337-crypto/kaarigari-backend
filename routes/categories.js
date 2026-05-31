const express = require("express");
const router = express.Router();
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const upload = require("../middleware/uploadMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/", listCategories);
router.post("/", adminMiddleware, upload.single("image"), createCategory);
router.patch("/:id", adminMiddleware, upload.single("image"), updateCategory);
router.delete("/:id", adminMiddleware, deleteCategory);

module.exports = router;
