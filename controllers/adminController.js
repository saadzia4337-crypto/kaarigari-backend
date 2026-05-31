const User = require("../models/User");

/**
 * GET /api/admin/users?role=seller|buyer&search=...
 * Admin only. Returns users without password. Search: regex on firstName, lastName; for seller also shopName.
 */
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    if (!role || !["seller", "buyer"].includes(role)) {
      return res.status(400).json({ message: "role must be seller or buyer" });
    }
    const filter = { role };
    if (search && String(search).trim()) {
      const term = String(search).trim();
      const regex = new RegExp(term, "i");
      if (role === "seller") {
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { shopName: regex },
        ];
      } else {
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
        ];
      }
    }
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/admin/users/:id - update user (admin only). Body: { bestSeller (boolean) }
 */
exports.updateUser = async (req, res) => {
  try {
    const { bestSeller } = req.body;
    if (typeof bestSeller !== "boolean") {
      return res.status(400).json({ message: "bestSeller must be a boolean" });
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role !== "seller") {
      return res.status(400).json({ message: "bestSeller can only be set for sellers" });
    }
    user.bestSeller = bestSeller;
    await user.save();
    res.json({ _id: user._id, bestSeller: user.bestSeller });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
