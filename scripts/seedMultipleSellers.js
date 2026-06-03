/**
 * Seed multiple seller users. Run from backend root: node scripts/seedMultipleSellers.js
 * Creates or updates 10 seller users with emails test11-20@gmail.com
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const SELLERS = [
  {
    firstName: "Ahmed",
    lastName: "Khan",
    email: "test11@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Fashion Hub",
    bio: "Professional tailor with expertise in modern designs",
    streetAddress: "111",
    city: "Karachi",
  },
  {
    firstName: "Fatima",
    lastName: "Ali",
    email: "test12@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Style Studio",
    bio: "Expert in traditional and contemporary clothing",
    streetAddress: "112",
    city: "Lahore",
  },
  {
    firstName: "Muhammad",
    lastName: "Hassan",
    email: "test13@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Tailor Craft",
    bio: "Specializing in custom fitted garments",
    streetAddress: "113",
    city: "Islamabad",
  },
  {
    firstName: "Ayesha",
    lastName: "Malik",
    email: "test14@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Design House",
    bio: "Creative designs for all occasions",
    streetAddress: "114",
    city: "Faisalabad",
  },
  {
    firstName: "Omar",
    lastName: "Siddiqui",
    email: "test15@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Elegant Wear",
    bio: "Luxury tailoring services",
    streetAddress: "115",
    city: "Rawalpindi",
  },
  {
    firstName: "Zara",
    lastName: "Ahmed",
    email: "test16@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Custom Fit",
    bio: "Perfect fit guaranteed",
    streetAddress: "116",
    city: "Multan",
  },
  {
    firstName: "Bilal",
    lastName: "Raza",
    email: "test17@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Modern Tailor",
    bio: "Contemporary fashion specialist",
    streetAddress: "117",
    city: "Peshawar",
  },
  {
    firstName: "Sana",
    lastName: "Butt",
    email: "test18@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Classic Style",
    bio: "Timeless designs and quality",
    streetAddress: "118",
    city: "Quetta",
  },
  {
    firstName: "Usman",
    lastName: "Sheikh",
    email: "test19@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Premium Tailor",
    bio: "High-end custom clothing",
    streetAddress: "119",
    city: "Sialkot",
  },
  {
    firstName: "Khadija",
    lastName: "Iqbal",
    email: "test20@gmail.com",
    password: "test1234",
    role: "seller",
    shopName: "Artisan Studio",
    bio: "Handcrafted with attention to detail",
    streetAddress: "120",
    city: "Gujranwala",
  },
];

async function seedMultipleSellers() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  for (const seller of SELLERS) {
    try {
      const hashedPassword = await bcrypt.hash(seller.password, 10);
      const existing = await User.findOne({ email: seller.email });
      
      if (existing) {
        existing.firstName = seller.firstName;
        existing.lastName = seller.lastName;
        existing.password = hashedPassword;
        existing.role = seller.role;
        existing.shopName = seller.shopName;
        existing.bio = seller.bio;
        existing.streetAddress = seller.streetAddress;
        existing.city = seller.city;
        await existing.save();
        console.log("Seller user updated:", seller.email);
      } else {
        await User.create({
          firstName: seller.firstName,
          lastName: seller.lastName,
          email: seller.email,
          password: hashedPassword,
          role: seller.role,
          shopName: seller.shopName,
          bio: seller.bio,
          streetAddress: seller.streetAddress,
          city: seller.city,
        });
        console.log("Seller user created:", seller.email);
      }
    } catch (error) {
      console.error("Error processing seller", seller.email, ":", error.message);
    }
  }
  
  console.log("Seeding completed!");
  await mongoose.disconnect();
  process.exit(0);
}

seedMultipleSellers().catch((err) => {
  console.error(err);
  process.exit(1);
});
