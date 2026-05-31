const express = require("express");
const router = express.Router();
const User = require("../models/User");

/**
 * GET /api/sellers?bestSeller=true - public. Returns sellers (best sellers when bestSeller=true).
 */
router.get("/", async (req, res) => {
  try {
    const bestSellerOnly = req.query.bestSeller === "true";
    const filter = { role: "seller" };
    if (bestSellerOnly) filter.bestSeller = true;
    const sellers = await User.find(filter)
      .select("firstName lastName shopName profilePic city bestSeller")
      .sort({ createdAt: -1 });
    res.json(sellers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
