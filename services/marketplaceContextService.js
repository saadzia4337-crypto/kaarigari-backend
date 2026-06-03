const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');

const CHEAPEST_INTENT_RE =
  /\b(cheapest|lowest\s*price|least\s*expensive|most\s*affordable|best\s*deal|lowest\s*cost|cheaper|sasta|sasti|kam\s*qeemat|kam\s*daam|sab\s*se\s*sasta)\b/i;

const RATING_INTENT_RE =
  /\b(best\s*rated|highest\s*rated|top\s*rated|best\s*review|good\s*reviews|high\s*rating|top\s*tailor|best\s*tailor|recommend.*tailor|recommend.*seller|which\s*tailor.*best|who\s*has\s*best\s*rating|star\s*rating|behtareen|sab\s*se\s*acha|sab\s*se\s*behtar|zyada\s*rating|reviews)\b/i;

const SELLER_INTENT_RE =
  /\b(tailor|seller|shop|karigar|store|vendor|who\s+is|which\s+tailor|which\s+seller|recommend\s+a\s+tailor|suggest\s+a\s+tailor|suggest\s+tailor)\b/i;

const CATEGORY_QUERY_RE =
  /\b(for|in|of|category|under)\b/i;

const NEARBY_INTENT_RE =
  /\b(near|nearby|close\s*to|around|qareeb|qareeb|pas|pass|area|street\s*address|this\s*address|meri?\s*street|mera\s*address|mere\s*ghar|same\s*area|address\s*ke|location\s*ke|kahan\s*hai|kahan\s*par|where\s*is|find\s*tailor|kon\s*sa\s*tailor|which\s*tailor)\b/i;

const LOCATION_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'who', 'how',
  'near', 'nearby', 'close', 'around', 'qareeb', 'pas', 'pass', 'area', 'address', 'street',
  'tailor', 'tailors', 'seller', 'sellers', 'shop', 'shops', 'karigar', 'store', 'vendor',
  'kon', 'konsa', 'konsay', 'hai', 'hain', 'ha', 'ho', 'ka', 'ke', 'ki', 'ko', 'mein', 'men',
  'par', 'se', 'sy', 'say', 'kya', 'koi', 'mujhe', 'mujhay', 'batao', 'bata', 'tell', 'find',
  'lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar',
  'registered', 'platform', 'kaarigari', 'app', 'list', 'show', 'give',
]);

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sellerDisplayName(seller) {
  if (!seller) return 'Unknown seller';
  if (seller.shopName && String(seller.shopName).trim()) return String(seller.shopName).trim();
  const name = [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim();
  return name || 'Unknown seller';
}

function resolveSellerStreet(seller) {
  if (!seller) return '';
  return String(seller.streetAddress || seller.streetNumber || '').trim();
}

function formatSellerAddress(seller) {
  const street = resolveSellerStreet(seller);
  const city = String(seller?.city || '').trim();
  return [street, city].filter(Boolean).join(', ') || 'address not on file';
}

async function loadSellerProfiles() {
  return User.find({ role: 'seller' })
    .select('firstName lastName shopName city streetAddress streetNumber bestSeller')
    .lean();
}

function extractLocationHints(message, sellers) {
  const text = normalizeText(message);
  const cities = [
    ...new Set(
      sellers
        .map((s) => normalizeText(s.city))
        .filter((c) => c.length >= 3)
    ),
  ];
  let matchedCity = '';
  for (const c of cities.sort((a, b) => b.length - a.length)) {
    if (text.includes(c)) {
      matchedCity = c;
      break;
    }
  }

  let streetPhrase = '';
  let bestLen = 0;
  for (const s of sellers) {
    const st = normalizeText(resolveSellerStreet(s));
    if (st.length >= 4 && text.includes(st) && st.length > bestLen) {
      streetPhrase = st;
      bestLen = st.length;
    }
  }

  const tokens = text
    .split(' ')
    .filter((w) => w.length >= 3 && !LOCATION_STOP_WORDS.has(w));

  return { city: matchedCity, streetPhrase, tokens };
}

function wantsProfileAddress(message) {
  const text = normalizeText(message);
  return /\b(my|meri|mera|mere|apni|profile|account)\b/.test(text) &&
    /\b(address|location|area|street|ghar)\b/.test(text);
}

function isNearbyTailorQuestion(message) {
  if (isRatingSellerQuestion(message) || isCheapestSellerQuestion(message)) return false;
  const text = normalizeText(message);
  if (!text) return false;
  const hasSeller = SELLER_INTENT_RE.test(text) || /\b(karigar|shop)\b/i.test(text);
  if (!hasSeller && !/\b(kon\s*sa|which|who|kahan)\b/i.test(text)) return false;
  if (NEARBY_INTENT_RE.test(text)) return true;
  if (/\b(street|address|location|area)\b/i.test(text) && hasSeller) return true;
  return false;
}

function isCityTailorsQuestion(message, sellers) {
  const text = normalizeText(message);
  if (!text) return false;
  if (!SELLER_INTENT_RE.test(text) && !/\b(karigar|shops?)\b/i.test(text)) return false;
  const hints = extractLocationHints(message, sellers);
  if (!hints.city) return false;
  if (isNearbyTailorQuestion(message)) return false;
  return /\b(in|at|from|city|area|ka|ke|list|show|all)\b/i.test(text) ||
    /\b(tailor|seller|karigar)\b/i.test(text);
}

function scoreSellerForLocation(seller, searchStreet, searchCity, hints) {
  const street = normalizeText(resolveSellerStreet(seller));
  const city = normalizeText(seller.city || '');
  let score = 0;

  if (searchCity) {
    if (city === searchCity) score += 14;
    else if (city.includes(searchCity) || searchCity.includes(city)) score += 8;
  }

  if (searchStreet && street) {
    if (street === searchStreet) score += 30;
    else if (street.includes(searchStreet) || searchStreet.includes(street)) score += 22;
    else {
      const searchTokens = searchStreet.split(' ').filter((w) => w.length >= 3);
      for (const t of searchTokens) {
        if (street.includes(t)) score += 8;
      }
    }
  }

  const tokenList = hints.tokens.length
    ? hints.tokens
    : searchStreet.split(' ').filter((w) => w.length >= 4);

  for (const t of tokenList) {
    if (street.includes(t)) score += 10;
    if (city.includes(t)) score += 5;
  }

  if (hints.streetPhrase && street.includes(hints.streetPhrase)) score += 20;
  if (hints.city && city === hints.city) score += 10;

  return score;
}

function findNearbyTailors(message, sellers, userProfile = {}) {
  const text = normalizeText(message);
  const hints = extractLocationHints(message, sellers);
  const useProfile = wantsProfileAddress(message);

  let searchStreet = hints.streetPhrase || '';
  let searchCity = hints.city || '';

  if (useProfile || (!searchStreet && !hints.tokens.length && userProfile.streetAddress)) {
    searchStreet = normalizeText(
      userProfile.streetAddress || userProfile.streetNumber || searchStreet
    );
    searchCity = normalizeText(userProfile.city || searchCity);
  }

  if (!searchStreet && !searchCity && hints.tokens.length === 0) {
    return { matches: [], searchLabel: '' };
  }

  const searchLabel = [
    searchStreet ? searchStreet.replace(/\b\w/g, (c) => c.toUpperCase()) : '',
    searchCity ? searchCity.replace(/\b\w/g, (c) => c.toUpperCase()) : '',
  ]
    .filter(Boolean)
    .join(', ');

  const scored = sellers
    .map((seller) => ({
      seller,
      score: scoreSellerForLocation(seller, searchStreet, searchCity, hints),
      address: formatSellerAddress(seller),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return { matches: scored.slice(0, 6), searchLabel };
}

function listTailorsInCity(cityNorm, sellers) {
  return sellers.filter((s) => {
    const c = normalizeText(s.city || '');
    return c === cityNorm || c.includes(cityNorm) || cityNorm.includes(c);
  });
}

function formatNearbyAnswer(matches, searchLabel) {
  if (!matches.length) {
    const loc = searchLabel ? ` for **${searchLabel}**` : '';
    return (
      `Kaarigari par is location ke qareeb koi registered tailor nahi mila${loc}. ` +
      `Try a nearby area name, full street, or city (e.g. Karachi, Islamabad). ` +
      `Sellers can add their street address in profile so buyers can find them.`
    );
  }

  const loc = searchLabel ? ` near **${searchLabel}**` : '';
  let answer =
    matches.length === 1
      ? `**Tailor on Kaarigari${loc}:**\n\n`
      : `**${matches.length} tailors on Kaarigari${loc}** (best match first):\n\n`;

  matches.forEach((item, i) => {
    const name = sellerDisplayName(item.seller);
    answer += `${i + 1}. **${name}**\n   Address: ${item.address}\n`;
  });

  answer += `\nOpen their shop in the app to see products or message them directly.`;
  return answer;
}

function formatCityTailorsAnswer(cityDisplay, tailors) {
  if (!tailors.length) {
    return `Kaarigari par **${cityDisplay}** mein abhi koi registered tailor nahi hai. Check another city or browse all products.`;
  }

  let answer = `**Tailors in ${cityDisplay}** on Kaarigari (${tailors.length}):\n\n`;
  tailors.forEach((s, i) => {
    answer += `${i + 1}. **${sellerDisplayName(s)}**\n   Address: ${formatSellerAddress(s)}\n`;
  });
  answer += `\nMessage any tailor from their product page for custom orders.`;
  return answer;
}

function buildAllSellersContext(sellers, max = 45) {
  if (!sellers.length) {
    return 'No tailors registered on Kaarigari yet.';
  }
  const cities = [...new Set(sellers.map((s) => (s.city || '').trim()).filter(Boolean))].sort();
  const slice = sellers.slice(0, max);
  const lines = slice.map((s) => {
    return `- ${sellerDisplayName(s)} | ${formatSellerAddress(s)}`;
  });
  let text =
    `Kaarigari tailor directory (${sellers.length} sellers). Cities on platform: ${cities.join(', ') || 'various'}.\n` +
    `IMPORTANT: Answer for ANY city above — do NOT assume only Lahore unless the user asked for Lahore.\n`;
  text += lines.join('\n');
  if (sellers.length > max) {
    text += `\n... and ${sellers.length - max} more tailors.`;
  }
  return text;
}

/**
 * Detect if the user wants a tailor/seller suggestion by ratings/reviews.
 */
function isRatingSellerQuestion(message) {
  const text = normalizeText(message);
  if (!text) return false;
  const hasRatingIntent = RATING_INTENT_RE.test(text);
  const hasSellerIntent = SELLER_INTENT_RE.test(text);
  if (hasRatingIntent && (hasSellerIntent || CATEGORY_QUERY_RE.test(text))) return true;
  if (hasRatingIntent && /\b(shalwar|kameez|kurta|suit|dress|shirt|pant|dupatta|lehenga|sherwani)\b/i.test(text)) {
    return true;
  }
  // "best tailor for shalwar kameez" (best = rating, not price)
  if (
    /\b(best|top)\b/i.test(text) &&
    hasSellerIntent &&
    !CHEAPEST_INTENT_RE.test(text)
  ) {
    return true;
  }
  return hasRatingIntent && hasSellerIntent;
}

/**
 * Detect if the user is asking for the cheapest tailor/seller (optionally for a category).
 */
function isCheapestSellerQuestion(message) {
  if (isRatingSellerQuestion(message)) return false;
  const text = normalizeText(message);
  if (!text) return false;
  const hasPriceIntent = CHEAPEST_INTENT_RE.test(text);
  const hasSellerIntent = SELLER_INTENT_RE.test(text);
  // "cheapest shalwar kameez" without saying tailor still counts
  if (hasPriceIntent && (hasSellerIntent || CATEGORY_QUERY_RE.test(text))) return true;
  if (hasPriceIntent && /\b(shalwar|kameez|kurta|suit|dress|shirt|pant|dupatta|lehenga|sherwani)\b/i.test(text)) {
    return true;
  }
  return hasPriceIntent && hasSellerIntent;
}

/**
 * Match a category from the user message using DB category titles (partial / word overlap).
 */
function resolveCategoryFromMessage(message, categories) {
  const text = normalizeText(message);
  if (!text || !categories?.length) return null;

  let best = null;
  let bestScore = 0;

  for (const cat of categories) {
    const title = normalizeText(cat.title);
    if (!title) continue;

    // Full title substring in message (e.g. "shalwar kameez")
    if (text.includes(title)) {
      const score = title.length + 10;
      if (score > bestScore) {
        bestScore = score;
        best = cat;
      }
      continue;
    }

    // Word overlap: all significant words from category title appear in message
    const words = title.split(' ').filter((w) => w.length > 2);
    if (words.length === 0) continue;
    const matched = words.filter((w) => text.includes(w)).length;
    const ratio = matched / words.length;
    if (ratio >= 0.6 && matched >= 1) {
      const score = matched * 5 + ratio * 10;
      if (score > bestScore) {
        bestScore = score;
        best = cat;
      }
    }
  }

  return best;
}

/**
 * Products belonging to a category (by id or title keywords in product title).
 */
function filterProductsForCategory(products, category) {
  if (!category) return [];
  const catId = String(category._id);
  const titleNorm = normalizeText(category.title);
  const titleWords = titleNorm.split(' ').filter((w) => w.length > 2);

  return products.filter((p) => {
    if (String(p.category) === catId) return true;
    const pTitle = normalizeText(p.title);
    if (titleNorm && pTitle.includes(titleNorm)) return true;
    if (titleWords.length > 0) {
      const hit = titleWords.filter((w) => pTitle.includes(w)).length;
      return hit >= Math.min(2, titleWords.length);
    }
    return false;
  });
}

/**
 * Cheapest in-stock product in a list; returns { product, sellerName, price }.
 */
function pickCheapestProduct(products) {
  const available = products.filter(
    (p) => p.price != null && !isNaN(Number(p.price)) && Number(p.quantity) > 0
  );
  if (available.length === 0) {
    const any = products.filter((p) => p.price != null && !isNaN(Number(p.price)));
    if (any.length === 0) return null;
    available.push(...any);
  }

  let cheapest = available[0];
  for (const p of available) {
    if (Number(p.price) < Number(cheapest.price)) cheapest = p;
  }

  return {
    product: cheapest,
    sellerName: sellerDisplayName(cheapest.seller),
    tailorName: [cheapest.seller?.firstName, cheapest.seller?.lastName].filter(Boolean).join(' ').trim(),
    shopName: cheapest.seller?.shopName || '',
    price: Number(cheapest.price),
    productTitle: cheapest.title,
    city: cheapest.seller?.city || '',
  };
}

/**
 * Per-seller rating in a product list (weighted by review count on each product).
 */
function aggregateSellerRatings(products) {
  const bySeller = new Map();

  for (const p of products) {
    const seller = p.seller;
    const sid = seller?._id ? String(seller._id) : seller ? String(seller) : null;
    if (!sid) continue;

    const rating = Number(p.averageRating) || 0;
    const count = Number(p.reviewCount) || 0;

    if (!bySeller.has(sid)) {
      bySeller.set(sid, {
        seller,
        weightedSum: 0,
        totalReviews: 0,
        topProduct: null,
        topProductRating: -1,
      });
    }
    const entry = bySeller.get(sid);
    entry.weightedSum += rating * count;
    entry.totalReviews += count;
    if (rating > entry.topProductRating || (rating === entry.topProductRating && count > 0)) {
      entry.topProductRating = rating;
      entry.topProduct = p;
    }
  }

  return Array.from(bySeller.values())
    .map((e) => ({
      seller: e.seller,
      sellerName: sellerDisplayName(e.seller),
      tailorName: [e.seller?.firstName, e.seller?.lastName].filter(Boolean).join(' ').trim(),
      shopName: e.seller?.shopName || '',
      city: e.seller?.city || '',
      avgRating: e.totalReviews > 0 ? Math.round((e.weightedSum / e.totalReviews) * 10) / 10 : 0,
      totalReviews: e.totalReviews,
      topProduct: e.topProduct,
    }))
    .filter((e) => e.totalReviews > 0)
    .sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return b.totalReviews - a.totalReviews;
    });
}

function pickTopRatedSeller(products) {
  const ranked = aggregateSellerRatings(products);
  return ranked.length > 0 ? ranked[0] : null;
}

function formatStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(Math.min(5, Math.max(0, full))) + '☆'.repeat(Math.max(0, 5 - full));
}

/**
 * Build top-rated tailor answer for one category.
 */
function formatRatingAnswer(category, pick, products, topN = 3) {
  const inCat = filterProductsForCategory(products || [], category);
  const ranked = aggregateSellerRatings(inCat);

  if (!pick && ranked.length === 0) {
    return (
      `I couldn't find any **reviewed** products for **${category.title}** on Kaarigari yet. ` +
      `Try again after buyers leave ratings, or browse the Products tab.`
    );
  }

  const best = pick || ranked[0];
  const tailorPart = best.tailorName
    ? best.shopName
      ? `**${best.tailorName}** (shop: **${best.shopName}**)`
      : `**${best.tailorName}**`
    : `**${best.sellerName}**`;
  const cityPart = best.city ? ` — ${best.city}` : '';
  const productLine = best.topProduct
    ? `Top product: **${best.topProduct.title}** (PKR ${Number(best.topProduct.price).toLocaleString()})`
    : '';

  let answer =
    `For **${category.title}**, the **best-rated tailor** on Kaarigari is ${tailorPart}${cityPart}.\n\n` +
    `Rating: **${best.avgRating}/5** ${formatStars(best.avgRating)} (${best.totalReviews} review${best.totalReviews === 1 ? '' : 's'})\n`;
  if (productLine) answer += `${productLine}\n`;

  if (ranked.length > 1) {
    const others = ranked.slice(1, topN);
    answer += `\nOther highly rated tailors for ${category.title}:\n`;
    others.forEach((r, i) => {
      answer += `• ${r.sellerName} — ${r.avgRating}/5 (${r.totalReviews} reviews)\n`;
    });
  }

  answer += `\nOpen their product page to order or message them for custom fitting.`;
  return answer;
}

/**
 * Overview: top-rated tailor per category.
 */
function buildTopRatedByCategorySummary(categories, products, limit = 10) {
  const lines = [];
  for (const cat of categories.slice(0, limit)) {
    const inCat = filterProductsForCategory(products, cat);
    const pick = pickTopRatedSeller(inCat);
    if (pick) {
      lines.push(
        `- ${cat.title}: ${pick.sellerName} — ${pick.avgRating}/5 (${pick.totalReviews} reviews)`
      );
    }
  }
  return lines.join('\n');
}

/**
 * Build cheapest-seller answer for one category.
 */
function formatCheapestAnswer(category, pick) {
  if (!pick) {
    return `I couldn't find any listed products for **${category.title}** on Kaarigari right now. Try browsing the Products tab or ask about another category.`;
  }

  const tailorPart = pick.tailorName
    ? pick.shopName
      ? `Tailor: **${pick.tailorName}** (shop: **${pick.shopName}**)`
      : `Tailor / seller: **${pick.tailorName}**`
    : `Seller: **${pick.sellerName}**`;

  const cityPart = pick.city ? ` — ${pick.city}` : '';
  const priceStr = `PKR ${pick.price.toLocaleString()}`;

  return (
    `For **${category.title}**, the lowest price on Kaarigari is **${priceStr}**.\n\n` +
    `${tailorPart}${cityPart}\n` +
    `Product: **${pick.productTitle}**\n\n` +
    `Open the product in the app to order or message the seller for custom measurements.`
  );
}

/**
 * Overview: cheapest seller per category (for prompts without a specific category).
 */
function buildCheapestByCategorySummary(categories, products, limit = 12) {
  const lines = [];
  for (const cat of categories.slice(0, limit)) {
    const inCat = filterProductsForCategory(products, cat);
    const pick = pickCheapestProduct(inCat);
    if (pick) {
      lines.push(
        `- ${cat.title}: ${pick.sellerName} — PKR ${pick.price.toLocaleString()} ("${pick.productTitle}")`
      );
    }
  }
  return lines.join('\n');
}

/**
 * Main entry: insights for AI chat from live marketplace data.
 * @param {string} userMessage
 * @param {{ city?: string, streetAddress?: string }} [userProfile]
 */
async function getMarketplaceInsights(userMessage, userProfile = {}) {
  const message = String(userMessage || '').trim();
  const [categories, products, sellers] = await Promise.all([
    Category.find().sort({ title: 1 }).lean(),
    Product.find({})
      .populate('seller', 'firstName lastName shopName city streetAddress streetNumber bestSeller')
      .lean(),
    loadSellerProfiles(),
  ]);

  const categoryListText = categories.map((c) => c.title).join(', ') || '(none)';
  const sellerDirectory = buildAllSellersContext(sellers);
  const base = {
    queryType: null,
    useDirectAnswer: false,
    directAnswer: null,
    systemContext: `Available product categories on Kaarigari: ${categoryListText}.\n\n${sellerDirectory}`,
    isCheapestQuery: false,
  };

  if (isNearbyTailorQuestion(message)) {
    const { matches, searchLabel } = findNearbyTailors(message, sellers, userProfile);
    const directAnswer = formatNearbyAnswer(
      matches.map((m) => ({ seller: m.seller, address: m.address })),
      searchLabel
    );
    const factLines = matches
      .map((m) => `FACT: ${sellerDisplayName(m.seller)} — ${m.address}`)
      .join('\n');

    return {
      queryType: 'nearby',
      useDirectAnswer: true,
      isCheapestQuery: false,
      directAnswer,
      systemContext: `${factLines || 'FACT: No matching tailors for this location.'}\n\n${sellerDirectory}`,
    };
  }

  if (isCityTailorsQuestion(message, sellers)) {
    const hints = extractLocationHints(message, sellers);
    const cityNorm = hints.city;
    const tailors = listTailorsInCity(cityNorm, sellers);
    const cityDisplay = (sellers.find((s) => normalizeText(s.city) === cityNorm)?.city || cityNorm)
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const directAnswer = formatCityTailorsAnswer(cityDisplay, tailors);

    return {
      queryType: 'city_tailors',
      useDirectAnswer: true,
      isCheapestQuery: false,
      directAnswer,
      systemContext: `Tailors in ${cityDisplay}:\n${tailors.map((s) => `- ${sellerDisplayName(s)} | ${formatSellerAddress(s)}`).join('\n')}\n\n${sellerDirectory}`,
    };
  }

  const isRating = isRatingSellerQuestion(message);
  const isCheapest = isCheapestSellerQuestion(message);

  if (!isRating && !isCheapest) {
    return base;
  }

  const matchedCategory = resolveCategoryFromMessage(message, categories);

  if (isRating) {
    if (matchedCategory) {
      const inCat = filterProductsForCategory(products, matchedCategory);
      const pick = pickTopRatedSeller(inCat);
      const directAnswer = formatRatingAnswer(matchedCategory, pick, products);
      const factLine = pick
        ? `FACT: Best rated ${matchedCategory.title} — ${pick.sellerName}, ${pick.avgRating}/5, ${pick.totalReviews} reviews. Use this exact data.`
        : `FACT: No reviewed products for ${matchedCategory.title}.`;

      return {
        queryType: 'rating',
        useDirectAnswer: true,
        isCheapestQuery: false,
        matchedCategory: matchedCategory.title,
        directAnswer,
        systemContext: `${factLine}\nCategories: ${categoryListText}.`,
      };
    }

    const summary = buildTopRatedByCategorySummary(categories, products);
    if (!summary) {
      return {
        queryType: 'rating',
        useDirectAnswer: true,
        isCheapestQuery: false,
        directAnswer:
          'No product reviews on Kaarigari yet, so I cannot suggest tailors by rating. Browse products and check back after customers leave reviews.',
        systemContext: `Categories: ${categoryListText}. No reviewed products.`,
      };
    }

    return {
      queryType: 'rating',
      useDirectAnswer: true,
      isCheapestQuery: false,
      matchedCategory: null,
      directAnswer:
        `**Top-rated tailors by category** on Kaarigari (from product reviews):\n\n${summary.replace(/^- /gm, '• ')}\n\n` +
        `Ask e.g. "best rated tailor for shalwar kameez" for one category.`,
      systemContext: `Top rated tailor per category:\n${summary}\nCategories: ${categoryListText}.`,
    };
  }

  // Cheapest flow
  if (matchedCategory) {
    const inCat = filterProductsForCategory(products, matchedCategory);
    const pick = pickCheapestProduct(inCat);
    const directAnswer = formatCheapestAnswer(matchedCategory, pick);
    const factLine = pick
      ? `FACT: Cheapest ${matchedCategory.title} — ${pick.sellerName}, PKR ${pick.price}, product "${pick.productTitle}". Use this exact data.`
      : `FACT: No products found for category ${matchedCategory.title}.`;

    return {
      queryType: 'cheapest',
      useDirectAnswer: true,
      isCheapestQuery: true,
      matchedCategory: matchedCategory.title,
      directAnswer,
      systemContext: `${factLine}\nCategories on platform: ${categoryListText}.`,
    };
  }

  const summary = buildCheapestByCategorySummary(categories, products);
  if (!summary) {
    return {
      queryType: 'cheapest',
      useDirectAnswer: true,
      isCheapestQuery: true,
      directAnswer:
        'There are no products listed on Kaarigari yet, so I cannot compare tailor prices. Please check back after sellers add items.',
      systemContext: `Categories: ${categoryListText}. No products in database.`,
    };
  }

  return {
    queryType: 'cheapest',
    useDirectAnswer: true,
    isCheapestQuery: true,
    matchedCategory: null,
    directAnswer:
      `Here are the **lowest listed prices by category** on Kaarigari:\n\n${summary.replace(/^- /gm, '• ')}\n\n` +
      `Ask me about a specific category (e.g. "cheapest tailor for shalwar kameez") for more detail.`,
    systemContext: `Cheapest price per category (use only this data):\n${summary}\nAll categories: ${categoryListText}.`,
  };
}

module.exports = {
  isCheapestSellerQuestion,
  isRatingSellerQuestion,
  isNearbyTailorQuestion,
  getMarketplaceInsights,
  resolveCategoryFromMessage,
  pickCheapestProduct,
  pickTopRatedSeller,
  aggregateSellerRatings,
  findNearbyTailors,
};
