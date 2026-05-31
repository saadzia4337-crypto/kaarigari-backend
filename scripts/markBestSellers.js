require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");

async function markBestSellers() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  try {
    // Mark first 6 sellers as best sellers
    const sellers = await User.find({ role: "seller" }).limit(6);
    
    console.log(`Marking ${sellers.length} sellers as best sellers:`);
    
    for (const seller of sellers) {
      seller.bestSeller = true;
      await seller.save();
      console.log(`✓ Marked as best seller: ${seller.firstName} ${seller.lastName} - ${seller.email}`);
    }
    
    console.log(`\n✅ Successfully marked ${sellers.length} sellers as best sellers!`);
    
    // Show all best sellers
    const bestSellers = await User.find({ role: "seller", bestSeller: true });
    console.log(`\nTotal best sellers: ${bestSellers.length}`);
    bestSellers.forEach((seller, i) => {
      console.log(`${i + 1}. ${seller.firstName} ${seller.lastName} - ${seller.shopName}`);
    });
    
  } catch (error) {
    console.error("Error marking best sellers:", error);
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

markBestSellers().catch((err) => {
  console.error(err);
  process.exit(1);
});
