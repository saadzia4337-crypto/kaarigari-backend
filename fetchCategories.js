const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('./models/Category');

async function fetchAllCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected\n');

    // Fetch all categories
    const categories = await Category.find({});

    console.log('=== ALL CATEGORIES IN DATABASE ===');
    console.log('Total categories:', categories.length);
    console.log('\nFormat: Title | Image | ID');
    console.log(''.padEnd(100, '-'));
    
    categories.forEach(category => {
      console.log(
        `${category.title} | ${category.image || 'N/A'} | ${category._id}`
      );
    });
    
    console.log(''.padEnd(100, '-'));
    console.log('\n=== DETAILED CATEGORY INFO ===\n');
    
    categories.forEach((category, index) => {
      console.log(`Category #${index + 1}:`);
      console.log(`  ID: ${category._id}`);
      console.log(`  Title: ${category.title}`);
      console.log(`  Image: ${category.image || 'N/A'}`);
      console.log(`  Created: ${category.createdAt}`);
      console.log(`  Updated: ${category.updatedAt}`);
      console.log('');
    });

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error fetching categories:', error);
    process.exit(1);
  }
}

fetchAllCategories();
