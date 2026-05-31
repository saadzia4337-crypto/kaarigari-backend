/**
 * Seed buyer user. Run from backend root: node scripts/seedBuyer.js
 * Creates or updates user with role buyer.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const BUYER = {
  firstName: "Test",
  lastName: "Buyer",
  email: "buyer@gmail.com",
  password: "buyer12",
  role: "buyer",
  streetNumber: "456",
  city: "Test City",
};

async function seedBuyer() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(BUYER.password, 10);
  const existing = await User.findOne({ email: BUYER.email });
  if (existing) {
    existing.firstName = BUYER.firstName;
    existing.lastName = BUYER.lastName;
    existing.password = hashedPassword;
    existing.role = BUYER.role;
    existing.streetNumber = BUYER.streetNumber;
    existing.city = BUYER.city;
    await existing.save();
    console.log("Buyer user updated:", BUYER.email);
  } else {
    await User.create({
      firstName: BUYER.firstName,
      lastName: BUYER.lastName,
      email: BUYER.email,
      password: hashedPassword,
      role: BUYER.role,
      streetNumber: BUYER.streetNumber,
      city: BUYER.city,
    });
    console.log("Buyer user created:", BUYER.email);
  }
  await mongoose.disconnect();
  process.exit(0);
}

seedBuyer().catch((err) => {
  console.error(err);
  process.exit(1);
});
