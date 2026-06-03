const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getOpenAIResponse, getOpenAIResponseWithVision, generateFashionImage, isOpenAIConfigured } = require('../services/openaiService');
const { getMarketplaceInsights } = require('../services/marketplaceContextService');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/ai-chat/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ai-chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Chat endpoint with image support
router.post('/message', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { message } = req.body;
    const imageFile = req.file;
    
    if (!message && !imageFile) {
      return res.status(400).json({ message: 'Message or image is required' });
    }
    
    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return res.status(503).json({ 
        message: 'AI service is not configured. Please add OPENAI_API_KEY to environment variables.' 
      });
    }
    
    // Get user context for personalized responses
    const userContext = {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.firstName || req.user.email,
      city: req.user.city || '',
      streetAddress: req.user.streetAddress || req.user.streetNumber || '',
    };
    
    // Prepare content for OpenAI
    let content = [];
    
    // Add text message if provided
    if (message) {
      content.push({
        type: 'text',
        text: message
      });
    }
    
    // Add image if provided
    if (imageFile) {
      // Convert image to base64 for OpenAI Vision API
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(imageFile.path);
      const base64Image = imageBuffer.toString('base64');
      
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${imageFile.mimetype};base64,${base64Image}`
        }
      });
    }
    
    const textMessage = message ? String(message).trim() : '';
    const marketplace = textMessage
      ? await getMarketplaceInsights(textMessage, userContext)
      : { useDirectAnswer: false, directAnswer: null, systemContext: '' };

    let aiResponse;
    if (marketplace.directAnswer && marketplace.useDirectAnswer && !imageFile) {
      aiResponse = marketplace.directAnswer;
    } else {
      aiResponse = await getOpenAIResponseWithVision(content, userContext, marketplace.systemContext);
    }
    
    // Log the interaction for analytics
    console.log(`AI Chat - User: ${userContext.name}, Message: "${message || '[Image only]'}", Image: ${!!imageFile}`);
    
    // Clean up uploaded file after processing
    if (imageFile) {
      const fs = require('fs');
      fs.unlink(imageFile.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }
    
    res.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
      hasImage: !!imageFile
    });
    
  } catch (error) {
    console.error('AI Chat error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      const fs = require('fs');
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image size should be less than 5MB' });
    }
    
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ message: 'Only image files are allowed' });
    }
    
    res.status(500).json({ message: 'Failed to process message' });
  }
});

// Generate image endpoint
router.post('/generate-image', authMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    const trimmed = prompt.trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    if (trimmed.length > 400) {
      return res.status(400).json({ message: 'Prompt is too long. Maximum 400 characters.' });
    }
    
    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return res.status(503).json({ 
        message: 'AI service is not configured. Please add OPENAI_API_KEY to environment variables.' 
      });
    }
    
    // Get user context for personalized responses
    const userContext = {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.firstName || req.user.email
    };
    
    // Generate image using DALL-E
    const imageResult = await generateFashionImage(trimmed, userContext);

    const imageUrl = imageResult.imageUrl.startsWith('http')
      ? imageResult.imageUrl
      : `${req.protocol}://${req.get('host')}${imageResult.imageUrl}`;

    // Log the interaction for analytics
    console.log(`AI Image Generation - User: ${userContext.name}, Prompt: "${trimmed}"`);

    res.json({
      success: true,
      imageUrl,
      revisedPrompt: imageResult.revisedPrompt,
      originalPrompt: imageResult.originalPrompt,
      timestamp: imageResult.timestamp
    });
    
  } catch (error) {
    console.error('AI Image Generation error:', error);
    res.status(500).json({ message: error.message || 'Failed to generate image' });
  }
});

// Get chat history (optional - for future implementation)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    // This would fetch chat history from database
    // For now, return empty history
    res.json({ history: [] });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ message: 'Failed to fetch chat history' });
  }
});

module.exports = router;
