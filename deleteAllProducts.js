require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function deleteAllProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Count products before deletion
    const count = await Product.countDocuments();
    console.log(`Found ${count} products in database`);

    if (count === 0) {
      console.log('No products to delete');
      process.exit(0);
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will delete ALL products from the database!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

    // Wait 5 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all products
    const result = await Product.deleteMany({});
    console.log(`\n✅ Successfully deleted ${result.deletedCount} products`);

    // Verify deletion
    const remainingCount = await Product.countDocuments();
    console.log(`Remaining products: ${remainingCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error deleting products:', error);
    process.exit(1);
  }
}

deleteAllProducts();
