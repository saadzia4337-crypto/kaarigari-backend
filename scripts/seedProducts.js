
/**
 * Seed products for all sellers. Run from backend root: node scripts/seedProducts.js
 * Creates 5 products for each seller using random categories
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");

// Product templates for different categories
const productTemplates = {
  "Women": [
    "Designer Kurti", "Embroidered Dress", "Casual Top", "Formal Gown", "Party Wear",
    "Summer Collection", "Winter Coat", "Handbag", "Scarf", "Traditional Outfit"
  ],
  "Boys - Kids": [
    "School Uniform", "Casual Shirt", "Sports Wear", "Party Dress", "Winter Jacket",
    "Shorts Set", "T-Shirt", "Formal Wear", "Play Clothes", "Seasonal Outfit"
  ],
  "Girls - Kids": [
    "Princess Dress", "School Uniform", "Party Gown", "Casual Wear", "Traditional Dress",
    "Summer Outfit", "Winter Coat", "Hair Accessories", "Bags", "Frock Collection"
  ],
  "Suits - Men": [
    "Business Suit", "Wedding Suit", "Formal Tuxedo", "Casual Blazer", "Three Piece Suit",
    "Executive Wear", "Party Suit", "Designer Suit", "Classic Suit", "Modern Fit"
  ],
  "Shalwar kameez - Men": [
    "Traditional Shalwar Kameez", "Designer Kurta", "Casual Wear", "Formal Wear", "Party Collection",
    "Embroidered Set", "Summer Collection", "Winter Collection", "Luxury Design", "Simple Design"
  ]
};

// Product descriptions
const descriptions = [
  "High quality fabric with excellent craftsmanship",
  "Premium material with modern design",
  "Comfortable and stylish for all occasions",
  "Traditional design with contemporary touch",
  "Perfect fit with attention to detail",
  "Luxurious feel and elegant appearance",
  "Durable material with lasting quality",
  "Fashionable and trendy design",
  "Classic style with modern twist",
  "Exclusive design for special occasions"
];

// Price ranges for different categories
const priceRanges = {
  "Women": { min: 1500, max: 8000 },
  "Boys - Kids": { min: 800, max: 3000 },
  "Girls - Kids": { min: 800, max: 3500 },
  "Suits - Men": { min: 3000, max: 15000 },
  "Shalwar kameez - Men": { min: 1200, max: 6000 }
};

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomPrice(category) {
  const range = priceRanges[category];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

function getRandomQuantity() {
  return Math.floor(Math.random() * 50) + 10; // 10-60 items
}

function getRandomSizes() {
  const allSizes = ["S", "M", "L"];
  const numSizes = Math.floor(Math.random() * 3) + 1; // 1-3 sizes
  const shuffled = allSizes.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numSizes);
}

async function seedProducts() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  try {
    // Get all sellers and categories
    const sellers = await User.find({ role: "seller" });
    const categories = await Category.find({});
    
    console.log(`Found ${sellers.length} sellers and ${categories.length} categories`);
    
    let totalProductsCreated = 0;
    
    for (const seller of sellers) {
      console.log(`\nCreating products for seller: ${seller.firstName} ${seller.lastName}`);
      
      for (let i = 0; i < 5; i++) {
        const category = getRandomItem(categories);
        const templates = productTemplates[category.title] || ["Product"];
        const template = getRandomItem(templates);
        
        // Create unique product title
        const productTitle = `${template} - ${seller.shopName} - ${i + 1}`;
        
        const productData = {
          title: productTitle,
          description: getRandomItem(descriptions),
          category: category.title,
          quantity: getRandomQuantity(),
          price: getRandomPrice(category.title),
          seller: seller._id,
          sizes: getRandomSizes(),
          images: [`https://picsum.photos/seed/${seller._id}-${i}-${Date.now()}/400/400.jpg`]
        };
        
        try {
          const product = await Product.create(productData);
          console.log(`  ✓ Created: ${product.title} - ${formatPrice(product.price)}`);
          totalProductsCreated++;
        } catch (error) {
          console.error(`  ✗ Failed to create product for ${seller.firstName}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Successfully created ${totalProductsCreated} products!`);
    
  } catch (error) {
    console.error("Error seeding products:", error);
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

function formatPrice(price) {
  return `Rs. ${price.toLocaleString()}`;
}

seedProducts().catch((err) => {
  console.error(err);
  process.exit(1);
});
