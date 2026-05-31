const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protects routes by verifying JWT and attaching req.user.
 * Use only on protected routes (e.g. router.get('/profile', authMiddleware, handler)).
 * Do NOT apply to /api/auth/signup or /api/auth/login.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized" });
  }
};

module.exports = authMiddleware;
