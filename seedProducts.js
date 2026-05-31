const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const Product = require('./models/Product');
const Category = require('./models/Category');
const User = require('./models/User');

async function seedProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected\n');

    // Fetch categories
    const categories = await Category.find({});
    console.log('Found categories:', categories.length);
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.title.toLowerCase()] = cat._id;
    });
    
    console.log('Category map:', categoryMap);

    // Fetch all sellers to distribute products
    const sellers = await User.find({ role: 'seller' });
    if (!sellers || sellers.length === 0) {
      console.error('No sellers found. Please create sellers first.');
      process.exit(1);
    }
    console.log(`Found ${sellers.length} sellers to distribute products`);

    // Get list of uploaded product images
    const uploadsDir = path.join(__dirname, 'uploads');
    const imageFiles = fs.readdirSync(uploadsDir)
      .filter(file => file.match(/\.(jpg|jpeg|png|webp)$/i))
      .filter(file => {
        // Only include product images (exclude profile pics, etc.)
        return file.includes('-') && 
          (file.startsWith('shervani') || 
           file.startsWith('maxi') || 
           file.startsWith('pent-coat') || 
           file.startsWith('shalwar') ||
           file.startsWith('girl') ||
           file.startsWith('boy') ||
           file.startsWith('shirt'));
      });

    console.log('Found product images:', imageFiles.length);

    // Create a product for each image
    const products = [];
    const categoryTitles = Object.keys(categoryMap);

    // Count products per seller for tracking
    const sellerProductCount = {};
    sellers.forEach(seller => {
      sellerProductCount[seller.email] = 0;
    });

    imageFiles.forEach((file, index) => {
      // Determine category based on image name
      let categoryTitle = '';
      let title = '';
      
      if (file.startsWith('shervani')) {
        categoryTitle = 'Shervani - Men';
        title = `Traditional Shervani ${index + 1}`;
      } else if (file.startsWith('maxi')) {
        categoryTitle = 'Maxi - Women';
        title = `Elegant Maxi Dress ${index + 1}`;
      } else if (file.startsWith('pent-coat')) {
        categoryTitle = 'Pent Coat';
        title = `Classic Pent Coat ${index + 1}`;
      } else if (file.startsWith('girl-shalwar')) {
        categoryTitle = 'Shalwar kameez';
        title = `Girls Shalwar Kameez ${index + 1}`;
      } else if (file.startsWith('boy-shalwar')) {
        categoryTitle = 'Shalwar kameez';
        title = `Boys Shalwar Kameez ${index + 1}`;
      } else if (file.startsWith('shirt')) {
        categoryTitle = 'Shalwar kameez';
        title = `Traditional Shalwar Kameez ${index + 1}`;
      }

      const categoryId = categoryMap[categoryTitle.toLowerCase()];
      
      if (!categoryId) {
        console.log(`Skipping ${file} - no matching category`);
        return;
      }

      // Distribute products among sellers using round-robin
      const sellerIndex = index % sellers.length;
      const seller = sellers[sellerIndex];
      sellerProductCount[seller.email]++;

      // Create product with single image
      const product = {
        images: [`uploads/${file}`],
        title: title,
        description: `High-quality ${title.toLowerCase()} made with premium materials. Perfect for special occasions and daily wear.`,
        category: categoryId.toString(),
        quantity: Math.floor(Math.random() * 50) + 10, // Random quantity 10-60
        price: Math.floor(Math.random() * 15000) + 3000, // Random price 3000-18000 PKR
        seller: seller._id,
        sizes: ['S', 'M', 'L'],
        averageRating: 0,
        reviewCount: 0,
        tryOnOverlay: ''
      };

      products.push(product);
      console.log(`Created product: ${title} -> Seller: ${seller.email} (${seller.shopName || 'No shop name'})`);
    });

    // Clear existing products (optional - comment out if you want to keep existing)
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert new products
    const insertedProducts = await Product.insertMany(products);
    console.log(`\nSuccessfully seeded ${insertedProducts.length} products`);

    // Display summary
    console.log('\n=== PRODUCT SEEDING SUMMARY ===');
    console.log(`Total products created: ${insertedProducts.length}`);
    console.log(`Total sellers: ${sellers.length}`);
    console.log(`Categories used: ${categoryTitles.join(', ')}`);
    console.log('\nProducts per seller:');
    sellers.forEach(seller => {
      console.log(`  - ${seller.email} (${seller.shopName || 'No shop name'}): ${sellerProductCount[seller.email]} products`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
}

seedProducts();
