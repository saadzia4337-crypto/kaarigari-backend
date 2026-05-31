const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');

async function checkProductImages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected\n');

    // Fetch all products
    const products = await Product.find({}).limit(5);

    console.log('=== SAMPLE PRODUCT IMAGES ===\n');
    
    products.forEach((product, index) => {
      console.log(`Product #${index + 1}: ${product.title}`);
      console.log(`Images: ${JSON.stringify(product.images)}`);
      console.log('');
    });

    // Check uploads folder
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, 'uploads');
    
    console.log('=== UPLOADS FOLDER CONTENT ===\n');
    const files = fs.readdirSync(uploadsDir).slice(0, 10);
    files.forEach(file => {
      console.log(file);
    });
    console.log(`\nTotal files in uploads: ${fs.readdirSync(uploadsDir).length}`);

    // Close connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProductImages();
