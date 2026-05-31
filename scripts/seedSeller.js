/**
 * Seed seller user. Run from backend root: node scripts/seedSeller.js
 * Creates or updates user with role seller.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const SELLER = {
  firstName: "Test",
  lastName: "Seller",
  email: "seller@gmail.com",
  password: "seller12",
  role: "seller",
  shopName: "Test Tailor Shop",
  bio: "Professional tailor with 10+ years of experience",
  streetNumber: "123",
  city: "Test City",
};

async function seedSeller() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(SELLER.password, 10);
  const existing = await User.findOne({ email: SELLER.email });
  if (existing) {
    existing.firstName = SELLER.firstName;
    existing.lastName = SELLER.lastName;
    existing.password = hashedPassword;
    existing.role = SELLER.role;
    existing.shopName = SELLER.shopName;
    existing.bio = SELLER.bio;
    existing.streetNumber = SELLER.streetNumber;
    existing.city = SELLER.city;
    await existing.save();
    console.log("Seller user updated:", SELLER.email);
  } else {
    await User.create({
      firstName: SELLER.firstName,
      lastName: SELLER.lastName,
      email: SELLER.email,
      password: hashedPassword,
      role: SELLER.role,
      shopName: SELLER.shopName,
      bio: SELLER.bio,
      streetNumber: SELLER.streetNumber,
      city: SELLER.city,
    });
    console.log("Seller user created:", SELLER.email);
  }
  await mongoose.disconnect();
  process.exit(0);
}

seedSeller().catch((err) => {
  console.error(err);
  process.exit(1);
});
