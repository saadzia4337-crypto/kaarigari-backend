const express = require("express");
const router = express.Router();
const {
  getPrimaryBanner,
  updatePrimaryBanner,
  getSecondaryBanner,
  updateSecondaryBanner,
} = require("../controllers/settingsController");
const upload = require("../middleware/uploadMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// Primary banner: GET public, PUT admin (multipart: optional image0, image1, image2 + title0, tagline0, cta0, ...)
router.get("/primary-banner", getPrimaryBanner);
router.put(
  "/primary-banner",
  adminMiddleware,
  upload.fields([
    { name: "image0", maxCount: 1 },
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
  ]),
  updatePrimaryBanner
);

// Secondary banner: GET public, PUT admin (optional single image + title, subtext)
router.get("/secondary-banner", getSecondaryBanner);
router.put("/secondary-banner", adminMiddleware, upload.single("image"), updateSecondaryBanner);

module.exports = router;
