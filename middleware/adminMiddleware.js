const authMiddleware = require("./authMiddleware");

/**
 * Requires auth, then requires req.user.role === 'admin'. Use after authMiddleware.
 */
const adminMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Admin access required" });
    }
  });
};

module.exports = adminMiddleware;
