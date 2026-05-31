const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const Category = require('./models/Category');
const User = require('./models/User');

async function fetchAllProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected\n');

    // Fetch all products with populated seller
    const products = await Product.find({})
      .populate('seller', 'email shopName');

    // Fetch all categories for mapping
    const categories = await Category.find({});
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.title;
    });

    console.log('=== ALL PRODUCTS IN DATABASE ===');
    console.log('Total products:', products.length);
    console.log('\nFormat: Title | Category | Price | Quantity | Seller | Images');
    console.log(''.padEnd(150, '-'));
    
    products.forEach(product => {
      const categoryName = categoryMap[product.category] || 'N/A';
      const sellerName = product.seller?.shopName || product.seller?.email || 'N/A';
      console.log(
        `${product.title} | ${categoryName} | ${product.price} PKR | ${product.quantity} | ${sellerName} | ${product.images.length} image(s)`
      );
    });
    
    console.log(''.padEnd(150, '-'));
    console.log('\n=== PRODUCTS BY CATEGORY ===\n');
    
    // Group by category
    const byCategory = {};
    products.forEach(product => {
      const catName = categoryMap[product.category] || 'Uncategorized';
      if (!byCategory[catName]) {
        byCategory[catName] = [];
      }
      byCategory[catName].push(product);
    });

    for (const [category, catProducts] of Object.entries(byCategory)) {
      console.log(`${category}: ${catProducts.length} products`);
      catProducts.forEach(p => {
        console.log(`  - ${p.title} (${p.price} PKR)`);
      });
      console.log('');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error fetching products:', error);
    process.exit(1);
  }
}

fetchAllProducts();
