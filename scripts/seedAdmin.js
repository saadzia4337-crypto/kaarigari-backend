/**
 * Seed admin user. Run from backend root: node scripts/seedAdmin.js
 * Creates or updates user with role admin.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const ADMIN = {
  firstName: "Saad",
  lastName: "Zia",
  email: "saadzia@gmail.com",
  password: "saadzia12",
  role: "admin",
};

async function seedAdmin() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(ADMIN.password, 10);
  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    existing.firstName = ADMIN.firstName;
    existing.lastName = ADMIN.lastName;
    existing.password = hashedPassword;
    existing.role = ADMIN.role;
    await existing.save();
    console.log("Admin user updated:", ADMIN.email);
  } else {
    await User.create({
      firstName: ADMIN.firstName,
      lastName: ADMIN.lastName,
      email: ADMIN.email,
      password: hashedPassword,
      role: ADMIN.role,
    });
    console.log("Admin user created:", ADMIN.email);
  }
  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
