const express = require("express");
const router = express.Router();
const { signup, login, updateProfile } = require("../controllers/authController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", upload.single("profilePic"), signup);
router.post("/login", login);
router.put("/profile", authMiddleware, upload.single("profilePic"), updateProfile);

module.exports = router;