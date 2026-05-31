require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Category = require("../models/Category");

async function checkCategories() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  try {
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories:`);
    categories.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.title} (ID: ${cat._id})`);
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

checkCategories().catch((err) => {
  console.error(err);
  process.exit(1);
});
