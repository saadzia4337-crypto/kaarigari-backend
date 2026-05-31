const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Send a message
router.post("/send", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text', productId } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !content) {
      return res.status(400).json({ message: "Receiver and content are required" });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content: content.trim(),
      messageType,
      productId: productId || null
    });

    await message.save();

    // Populate sender/receiver info for response
    await message.populate([
      { path: 'sender', select: 'firstName lastName profilePic' },
      { path: 'receiver', select: 'firstName lastName profilePic' }
    ]);

    // Emit to Socket.IO if available
    if (req.io) {
      req.io.to(receiverId).emit('message:receive', message);
      req.io.to(senderId).emit('message:sent', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get conversations for current user
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all messages where user is either sender or receiver
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate('sender', 'firstName lastName profilePic')
    .populate('receiver', 'firstName lastName profilePic')
    .sort({ createdAt: -1 })
    .limit(100); // Limit to last 100 messages

    // Group by conversation partner
    const conversations = {};
    messages.forEach(message => {
      const partnerId = message.sender._id.toString() === userId 
        ? message.receiver._id.toString() 
        : message.sender._id.toString();
      
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner: message.sender._id.toString() === userId ? message.receiver : message.sender,
          lastMessage: message,
          unreadCount: 0
        };
      }
      
      // Count unread messages
      if (message.receiver._id.toString() === userId && !message.read) {
        conversations[partnerId].unreadCount++;
      }
      
      // Update last message if newer
      if (new Date(conversations[partnerId].lastMessage.createdAt) < new Date(message.createdAt)) {
        conversations[partnerId].lastMessage = message;
      }
    });

    // Convert to array and sort by last message time
    const conversationList = Object.values(conversations).sort((a, b) => 
      new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );

    res.json(conversationList);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get messages between two users
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    })
    .populate('sender', 'firstName lastName profilePic')
    .populate('receiver', 'firstName lastName profilePic')
    .sort({ createdAt: 1 })
    .limit(50);

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Mark messages as read
router.put("/read/:messageId", authMiddleware, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.id;

    const message = await Message.findOneAndUpdate(
      { 
        _id: messageId, 
        receiver: userId,
        read: false 
      },
      { 
        read: true, 
        readAt: new Date() 
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // TODO: Emit read receipt via Socket.IO
    // req.io.to(message.sender.toString()).emit('message:read', { messageId, readAt: new Date() });

    res.json({ success: true, readAt: message.readAt });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Mark all messages from a sender as read
router.put("/read/:senderId/all", authMiddleware, async (req, res) => {
  try {
    const senderId = req.params.senderId;
    const userId = req.user.id;

    const result = await Message.updateMany(
      { 
        sender: senderId,
        receiver: userId,
        read: false 
      },
      { 
        read: true, 
        readAt: new Date() 
      }
    );

    res.json({ 
      success: true, 
      messagesUpdated: result.modifiedCount,
      readAt: new Date() 
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get unread message count
router.get("/unread/count", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      receiver: req.user.id,
      read: false
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: messages.length
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

// Delete a single message
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Find the message
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Check if user is sender or receiver
    if (message.sender.toString() !== req.user.id && message.receiver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }
    
    // Delete the message
    await Message.findByIdAndDelete(messageId);
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      // Notify both sender and receiver
      io.to(message.sender.toString()).emit('message:deleted', { messageId });
      io.to(message.receiver.toString()).emit('message:deleted', { messageId });
    }
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// Delete multiple messages
router.delete('/bulk', authMiddleware, async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message IDs'
      });
    }
    
    // Find messages and verify ownership
    const messages = await Message.find({
      _id: { $in: messageIds }
    });
    
    // Filter messages where user is sender or receiver
    const authorizedMessages = messages.filter(msg => 
      msg.sender.toString() === req.user.id || msg.receiver.toString() === req.user.id
    );
    
    if (authorizedMessages.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No authorized messages to delete'
      });
    }
    
    const authorizedIds = authorizedMessages.map(msg => msg._id);
    
    // Delete messages
    await Message.deleteMany({
      _id: { $in: authorizedIds }
    });
    
    // Emit socket events for real-time update
    const io = req.app.get('io');
    if (io) {
      authorizedMessages.forEach(message => {
        // Notify both sender and receiver
        io.to(message.sender.toString()).emit('message:deleted', { messageId: message._id });
        io.to(message.receiver.toString()).emit('message:deleted', { messageId: message._id });
      });
    }
    
    res.json({
      success: true,
      message: `${authorizedIds.length} messages deleted successfully`,
      deletedCount: authorizedIds.length
    });
  } catch (error) {
    console.error('Bulk delete messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete messages'
    });
  }
});

module.exports = router;
