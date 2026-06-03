const express = require("express");
const router = express.Router();
const User = require("../models/User");

/**
 * GET /api/sellers
 * Query: bestSeller=true (optional), search=... (shop / first / last name)
 */
router.get("/", async (req, res) => {
  try {
    const bestSellerOnly = req.query.bestSeller === "true";
    const search = req.query.search;
    const filter = { role: "seller" };
    if (bestSellerOnly) filter.bestSeller = true;
    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { shopName: regex },
      ];
    }
    const sellers = await User.find(filter)
      .select("firstName lastName shopName profilePic city bestSeller email")
      .sort({ createdAt: -1 });
    res.json(sellers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
