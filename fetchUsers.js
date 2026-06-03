const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function fetchAllUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected\n');

    // Fetch all users
    const users = await User.find({});

    console.log('=== ALL USERS IN DATABASE ===');
    console.log('Total users:', users.length);
    console.log('\nFormat: Email | Password | Role | Name | BestSeller | ID');
    console.log(''.padEnd(120, '-'));
    
    users.forEach(user => {
      console.log(
        `${user.email} | ${user.password} | ${user.role} | ${user.firstName} ${user.lastName} | ${user.bestSeller} | ${user._id}`
      );
    });
    
    console.log(''.padEnd(120, '-'));
    console.log('\n=== DETAILED USER INFO ===\n');
    
    users.forEach((user, index) => {
      console.log(`User #${index + 1}:`);
      console.log(`  ID: ${user._id}`);
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Shop Name: ${user.shopName || 'N/A'}`);
      console.log(`  Bio: ${user.bio || 'N/A'}`);
      console.log(`  Profile Pic: ${user.profilePic || 'N/A'}`);
      console.log(`  Address: ${user.streetAddress || 'N/A'}, ${user.city || 'N/A'}`);
      console.log(`  Best Seller: ${user.bestSeller}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(`  Updated: ${user.updatedAt}`);
      console.log('');
    });

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }
}

fetchAllUsers();
