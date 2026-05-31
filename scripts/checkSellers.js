require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");

async function checkSellers() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  try {
    const sellers = await User.find({ role: "seller" });
    console.log(`Found ${sellers.length} sellers:`);
    sellers.forEach((seller, i) => {
      console.log(`${i + 1}. ${seller.firstName} ${seller.lastName} - ${seller.email} (ID: ${seller._id})`);
    });
  } catch (error) {
    console.error("Error fetching sellers:", error);
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

checkSellers().catch((err) => {
  console.error(err);
  process.exit(1);
});
