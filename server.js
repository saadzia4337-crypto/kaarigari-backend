const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const app = express();

// Middleware — CORS allows any origin (needed for browsers only; React Native is not subject to CORS)
app.use( 
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", (req, res, next) => {
  console.log("[auth] Incoming:", req.method, req.originalUrl);
  next();
});
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/wishlist", require("./routes/wishlist"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/sellers", require("./routes/sellers"));
app.use("/api/size-charts", require("./routes/sizeCharts"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/ai-chat", require("./routes/aiChat"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/stripe", require("./routes/stripe"));

// Socket.IO middleware - pass io instance to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/messages", require("./routes/messages"));
// For protected routes: const authMiddleware = require("./middleware/authMiddleware");
// Then: router.get("/profile", authMiddleware, handler) — do not apply to signup/login.

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Kaarigari API!" });
});


// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store online users
const onlineUsers = new Map();

// Connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected");
    
    // Log all users with passwords and emails
    try {
      const User = require('./models/User');
      const users = await User.find({});
      console.log('=== ALL USERS IN DATABASE ===');
      console.log('Email, Password, Role, Name, BestSeller');
      users.forEach(user => {
        console.log(`${user.email}, ${user.password}, ${user.role}, ${user.firstName} ${user.lastName}, ${user.bestSeller}`);
      });
      console.log('============================');
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    
    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('=== SOCKET CONNECTION ===');
      console.log('Socket ID:', socket.id);
      console.log('Auth data:', socket.handshake.auth);
      
      // Extract user ID from JWT token
      const jwt = require('jsonwebtoken');
      let userId = null;
      
      try {
        if (socket.handshake.auth.token) {
          const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET || 'fallback_secret');
          userId = decoded.id;
          console.log('User ID from JWT token:', userId);
        }
      } catch (error) {
        console.error('JWT token verification failed:', error.message);
      }
      
      // Set user ID from JWT or wait for user:join event
      if (userId) {
        socket.userId = userId;
        console.log('Setting socket.userId:', socket.userId);
        
        // Auto-join user room
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        
        // Broadcast online status
        socket.broadcast.emit('user:online', { userId });
        console.log(`User ${userId} auto-joined their room`);
      }

      // Join user to their personal room (fallback)
      socket.on('user:join', (userId) => {
        console.log('=== USER JOIN EVENT ===');
        console.log('User ID from event:', userId);
        
        socket.userId = userId;
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        
        // Broadcast online status
        socket.broadcast.emit('user:online', { userId });
        console.log(`User ${userId} joined their room`);
      });

      // Handle sending messages
      socket.on('message:send', async (data) => {
        try {
          const { receiverId, content, messageType = 'text' } = data;
          
          console.log('=== MESSAGE SEND EVENT ===');
          console.log('Socket User ID:', socket.userId);
          console.log('Receiver ID:', receiverId);
          console.log('Message Content:', content);
          console.log('Online Users:', Array.from(onlineUsers.keys()));
          
          // Get current user info to determine role
          const User = require('./models/User');
          const currentUser = await User.findById(socket.userId);
          
          if (!currentUser) {
            console.error('Current user not found:', socket.userId);
            return;
          }
          
          console.log('Current User:', currentUser.email, '(', currentUser.role, ')');
          
          // Check if receiver is online
          const receiverSocketId = onlineUsers.get(receiverId);
          console.log('Receiver Socket ID:', receiverSocketId);
          console.log('Receiver is online:', !!receiverSocketId);
          
          // Create and save message to database
          const Message = require('./models/Message');
          const message = new Message({
            sender: socket.userId,
            receiver: receiverId,
            content,
            messageType
          });
          
          await message.save();
          await message.populate([
            { path: 'sender', select: 'firstName lastName profilePic' },
            { path: 'receiver', select: 'firstName lastName profilePic' }
          ]);

          // Route message correctly based on user roles
          console.log(`Message routing: ${currentUser.role} (${currentUser.email}) -> ${receiverId}`);
          
          // Send to receiver's room
          const sentToReceiver = io.to(receiverId).emit('message:receive', message);
          console.log('Message emitted to receiver room:', receiverId);
          
          // Send confirmation to sender
          socket.emit('message:sent', message);
          
          console.log(`Message sent from ${socket.userId} (${currentUser.role}) to ${receiverId}`);
          console.log('=============================');
        } catch (error) {
          console.error('Socket message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing:start', (receiverId) => {
        socket.to(receiverId).emit('user:typing', { userId: socket.userId, isTyping: true });
      });

      socket.on('typing:stop', (receiverId) => {
        socket.to(receiverId).emit('user:typing', { userId: socket.userId, isTyping: false });
      });

      // Handle read receipts
      socket.on('message:read', async (data) => {
        const { messageId, senderId } = data;
        
        try {
          // Update message in database
          const Message = require('./models/Message');
          await Message.findByIdAndUpdate(messageId, { 
            read: true, 
            readAt: new Date() 
          });

          // Notify sender
          io.to(senderId).emit('message:read', { messageId, readAt: new Date() });
        } catch (error) {
          console.error('Read receipt error:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
          onlineUsers.delete(socket.userId);
          socket.broadcast.emit('user:offline', { userId: socket.userId });
          console.log(`User ${socket.userId} disconnected`);
        }
      });
    });

    // Start server with Socket.IO
    server.listen(process.env.PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${process.env.PORT} (accepts connections from network)`);
      console.log('Socket.IO server initialized');
    });
  })
  .catch((err) => console.log(err));