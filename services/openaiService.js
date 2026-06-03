const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

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
 * Sanitize user prompt for DALL-E
 */
function sanitizeImagePrompt(prompt) {
  return String(prompt || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 400);
}

/**
 * Build a concise DALL-E prompt (long instruction blocks often trigger 400 errors)
 */
function buildDallePrompt(userPrompt) {
  return (
    `Professional fashion product photo for a tailoring catalog: ${userPrompt}. ` +
    'Garment on mannequin or flat lay, neutral studio background, soft lighting, ' +
    'fabric texture visible, no text, no watermark, no logo.'
  ).slice(0, 3900);
}

function mapOpenAIImageError(error) {
  const apiMsg = error?.error?.message || error?.message || '';
  const code = error?.error?.code || error?.code || '';

  if (error.status === 401) {
    return new Error('Image generation service is not available. Please check your API key.');
  }
  if (error.status === 429) {
    return new Error('Too many image generation requests. Please try again in a moment.');
  }
  if (error.status === 403) {
    return new Error('Image generation is not allowed with your current plan.');
  }
  if (
    code === 'content_policy_violation' ||
    /content policy|safety system|not allowed/i.test(apiMsg)
  ) {
    return new Error(
      'This description was blocked. Describe the outfit only, e.g. "maroon shalwar kameez on mannequin, cotton fabric, studio photo". Avoid real people names or sensitive content.'
    );
  }
  if (/prompt.*(too long|length|maximum)/i.test(apiMsg) || code === 'string_above_max_length') {
    return new Error('Description is too long. Please use a shorter prompt (under 400 characters).');
  }
  if (error.status === 400) {
    return new Error(
      apiMsg ||
        'Could not generate this image. Describe the clothing clearly (color, style, fabric) and avoid real person names.'
    );
  }
  return new Error('Failed to generate image. Please try again.');
}

async function callDalle(prompt) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const params = {
    model,
    prompt,
    n: 1,
    size: '1024x1024',
  };

  if (model === 'dall-e-3') {
    params.quality = 'standard';
  } else if (model === 'gpt-image-1') {
    params.quality = process.env.OPENAI_IMAGE_QUALITY || 'medium';
  }

  const response = await openai.images.generate(params);
  const item = response.data[0];

  if (item?.url) {
    return {
      imageUrl: item.url,
      revisedPrompt: item.revised_prompt || prompt,
    };
  }

  if (item?.b64_json) {
    const dir = path.join(__dirname, '../uploads/ai-generated');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `ai-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(item.b64_json, 'base64'));
    return {
      imageUrl: `/uploads/ai-generated/${filename}`,
      revisedPrompt: prompt,
    };
  }

  throw new Error('OpenAI returned no image data.');
}

/**
 * Use GPT to rewrite a safe, DALL-E-friendly fashion prompt
 */
async function refineImagePromptForDalle(userPrompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content:
          'Rewrite the user request as ONE DALL-E 3 image prompt for custom clothing/tailoring. ' +
          'Show only the garment (mannequin or flat lay), neutral background, professional catalog photo. ' +
          'No real people, no celebrity names, no violence. English. Max 800 characters. Output only the prompt.',
      },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 250,
    temperature: 0.6,
  });

  const refined = completion.choices[0]?.message?.content?.trim();
  if (!refined) {
    throw new Error('Could not refine the image description. Please try simpler wording.');
  }
  return buildDallePrompt(refined.slice(0, 800));
}

/**
 * Generate fashion image using DALL-E
 * @param {string} prompt - Image generation prompt
 * @param {Object} userContext - User information for context
 * @returns {Promise<Object>} Generated image URL and metadata
 */
async function generateFashionImage(prompt, userContext) {
  const cleaned = sanitizeImagePrompt(prompt);
  if (cleaned.length < 3) {
    throw new Error('Please enter a longer description (at least 3 characters).');
  }

  const dallePrompt = buildDallePrompt(cleaned);

  try {
    const result = await callDalle(dallePrompt);
    return {
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      originalPrompt: cleaned,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('DALL-E API error:', error?.error || error);

    if (error.status === 400) {
      try {
        console.log('DALL-E 400 — retrying with refined prompt for:', cleaned);
        const refinedPrompt = await refineImagePromptForDalle(cleaned);
        const result = await callDalle(refinedPrompt);
        return {
          imageUrl: result.imageUrl,
          revisedPrompt: result.revisedPrompt,
          originalPrompt: cleaned,
          timestamp: new Date().toISOString(),
        };
      } catch (retryError) {
        console.error('DALL-E retry failed:', retryError?.error || retryError);
        throw mapOpenAIImageError(retryError);
      }
    }

    throw mapOpenAIImageError(error);
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
