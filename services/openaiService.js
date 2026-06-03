const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get AI response from OpenAI
 * @param {string} userMessage - User's message
 * @param {Object} userContext - User information for context
 * @returns {Promise<string>} AI response
 */
function marketplacePromptBlock(marketplaceContext) {
  if (!marketplaceContext || !String(marketplaceContext).trim()) return '';
  return `

Live marketplace data from Kaarigari (always prefer this over guessing prices or seller names):
${marketplaceContext}

When the user asks for the cheapest tailor, seller, or lowest price for a category:
1. Use ONLY the marketplace data above.
2. State the seller/shop name and price in PKR clearly.
3. Mention the product title if provided.
4. Do not invent tailors or prices not listed above.

When the user asks for the best-rated / top-rated tailor or seller for a category:
1. Use ONLY the marketplace rating data above.
2. State the tailor/shop name and rating (out of 5) and review count.
3. Do not invent ratings or tailors not listed above.

When the user asks for tailors near an address, street, or city:
1. Use ONLY the tailor directory / nearby tailor data above.
2. Name specific tailor(s) with shop name and full address (street + city).
3. Cover ALL cities listed on the platform — never answer as if only Lahore exists unless the user asked for Lahore.`;
}

async function getOpenAIResponse(userMessage, userContext, marketplaceContext = '') {
  try {
    // Create system prompt based on user context
    const systemPrompt = `You are an expert AI fashion and tailoring consultant for Kaarigari, a premium custom clothing platform. 

Your expertise includes:
- Tailoring techniques and garment construction
- Fashion design and style recommendations
- Color combinations and fabric matching
- Custom measurements and fitting
- Dress styles and occasion-appropriate attire
- Traditional and modern clothing designs

User context:
- Name: ${userContext.name}
- Role: ${userContext.role} (buyer/seller/admin)
- Email: ${userContext.email}
- City: ${userContext.city || '(not set)'}
- Street address: ${userContext.streetAddress || '(not set)'}

Guidelines:
1. Focus ONLY on tailoring, clothing, fashion, design, and style topics
2. Provide expert fashion advice and design recommendations
3. Suggest color combinations that work well together
4. Give specific tailoring tips and measurement guidance
5. Recommend dress styles for different body types and occasions
6. Discuss fabric choices and their properties
7. Keep responses fashion-focused and helpful
8. If asked about non-fashion topics, politely redirect to clothing-related assistance

Platform features:
- Custom sizes: chest, waist, length, shoulders, sleeves (in inches)
- Direct messaging with professional tailors
- Custom clothing orders with design specifications

Respond to the user's message with expert fashion and tailoring advice:${marketplacePromptBlock(marketplaceContext)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Faster model for text responses
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 200, // Reduced for faster response
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Fallback responses for common errors
    if (error.status === 401) {
      return "I'm having trouble connecting to my AI services. Please contact support if this issue persists.";
    } else if (error.status === 429) {
      return "I'm receiving too many requests right now. Please try again in a moment.";
    } else if (error.status === 500) {
      return "I'm experiencing technical difficulties. Please try again later.";
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return "I'm taking longer than expected to respond. Please try again with a shorter message.";
    }
    
    // Generic fallback
    return "I'm having trouble responding right now. Please try again later or contact support for immediate assistance.";
  }
}

/**
 * Get AI response from OpenAI with vision capabilities
 * @param {Array} content - Array of content objects (text and/or images)
 * @param {Object} userContext - User information for context
 * @returns {Promise<string>} AI response
 */
async function getOpenAIResponseWithVision(content, userContext, marketplaceContext = '') {
  try {
    // Create system prompt based on user context
    const systemPrompt = `You are an expert AI fashion and tailoring consultant for Kaarigari, a premium custom clothing platform. 

Your expertise includes:
- Tailoring techniques and garment construction
- Fashion design and style recommendations
- Color combinations and fabric matching
- Custom measurements and fitting
- Dress styles and occasion-appropriate attire
- Traditional and modern clothing designs
- Visual analysis of clothing designs and fabrics

User context:
- Name: ${userContext.name}
- Role: ${userContext.role} (buyer/seller/admin)
- Email: ${userContext.email}
- City: ${userContext.city || '(not set)'}
- Street address: ${userContext.streetAddress || '(not set)'}

Guidelines:
1. Focus ONLY on tailoring, clothing, fashion, design, and style topics
2. Provide expert fashion advice and design recommendations
3. Suggest color combinations that work well together
4. Give specific tailoring tips and measurement guidance
5. Recommend dress styles for different body types and occasions
6. Discuss fabric choices and their properties
7. Keep responses fashion-focused and helpful
8. If asked about non-fashion topics, politely redirect to clothing-related assistance

Platform features:
- Custom sizes: chest, waist, length, shoulders, sleeves (in inches)
- Direct messaging with professional tailors
- Custom clothing orders with design specifications

When analyzing images, focus on:
- Clothing design details and style elements
- Color combinations and pattern matching
- Fabric texture and quality assessment
- Fit and tailoring quality
- Style recommendations for the garment
- Occasion appropriateness
- Customization suggestions

Respond to the user's message and/or image with expert fashion and tailoring advice:${marketplacePromptBlock(marketplaceContext)}`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: content
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Use current vision-capable model
      messages: messages,
      max_tokens: 300, // Reduced for faster response
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Vision API error:', error);
    
    // Fallback responses for common errors
    if (error.status === 401) {
      return "I'm having trouble connecting to my AI services. Please contact support if this issue persists.";
    } else if (error.status === 429) {
      return "I'm receiving too many requests right now. Please try again in a moment.";
    } else if (error.status === 500) {
      return "I'm experiencing technical difficulties. Please try again later.";
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return "I'm taking longer than expected to analyze the image. Please try with a smaller image or simpler question.";
    }
    
    // Generic fallback
    return "I'm having trouble analyzing the image right now. Please try again later or contact support for immediate assistance.";
  }
}

/**
 * Generate fashion image using DALL-E
 * @param {string} prompt - Image generation prompt
 * @param {Object} userContext - User information for context
 * @returns {Promise<Object>} Generated image URL and metadata
 */
async function generateFashionImage(prompt, userContext) {
  try {
    // Create fashion-focused prompt
    const fashionPrompt = `Create a professional fashion design image for Kaarigari clothing platform. 

User context: ${userContext.name} (${userContext.role})

Request: ${prompt}

Style requirements:
- Professional fashion photography style
- Clear, high-quality clothing visualization
- Appropriate for custom tailoring business
- Show fabric texture and details
- Clean background with focus on garment
- Realistic proportions and styling

Generate a high-quality fashion image that would be suitable for a custom clothing platform.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fashionPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid", // or "natural" for more realistic
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    return {
      imageUrl: imageUrl,
      revisedPrompt: revisedPrompt,
      originalPrompt: prompt,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('DALL-E API error:', error);
    
    // Fallback responses for common errors
    if (error.status === 401) {
      throw new Error('Image generation service is not available. Please check your API key.');
    } else if (error.status === 429) {
      throw new Error('Too many image generation requests. Please try again in a moment.');
    } else if (error.status === 400) {
      throw new Error('Invalid image request. Please try a different description.');
    } else if (error.status === 403) {
      throw new Error('Image generation is not allowed with your current plan.');
    }
    
    throw new Error('Failed to generate image. Please try again.');
  }
}

/**
 * Check if OpenAI is properly configured
 * @returns {boolean} True if API key is available
 */
function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = {
  getOpenAIResponse,
  getOpenAIResponseWithVision,
  generateFashionImage,
  isOpenAIConfigured,
};
