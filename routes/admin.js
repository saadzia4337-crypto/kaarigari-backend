const express = require("express");
const router = express.Router();
const { getUsers, updateUser } = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/users", adminMiddleware, getUsers);
router.patch("/users/:id", adminMiddleware, updateUser);

module.exports = router;
