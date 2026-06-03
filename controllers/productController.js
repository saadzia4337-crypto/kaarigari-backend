const Product = require("../models/Product");

// Create product (seller only, 1–5 images)
exports.createProduct = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can add products" });
    }

    const imageFiles = req.files && req.files.images ? req.files.images : [];
    const images = imageFiles.length ? imageFiles.map((f) => f.path.replace(/\\/g, "/")) : [];
    const tryOnArr = req.files && req.files.tryOnOverlay ? req.files.tryOnOverlay : [];
    const tryOnOverlay =
      tryOnArr.length > 0 && tryOnArr[0].path ? tryOnArr[0].path.replace(/\\/g, "/") : "";

    if (images.length < 1 || images.length > 5) {
      return res.status(400).json({
        message: "Product must have between 1 and 5 images",
      });
    }

    const { title, description, category, quantity, price, sizes: sizesRaw } = req.body;
    if (!title || description === undefined || quantity === undefined || price === undefined) {
      return res.status(400).json({
        message: "title, description, quantity and price are required",
      });
    }

    const numQuantity = Number(quantity);
    const numPrice = Number(price);
    if (isNaN(numQuantity) || numQuantity < 0 || isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({
        message: "quantity and price must be non-negative numbers",
      });
    }

    const allowedSizes = ["S", "M", "L"];
    let sizes = [];
    if (sizesRaw != null) {
      const parsed = typeof sizesRaw === "string" ? (() => { try { return JSON.parse(sizesRaw); } catch { return []; } })() : (Array.isArray(sizesRaw) ? sizesRaw : []);
      sizes = Array.isArray(parsed) ? parsed.filter((s) => allowedSizes.includes(String(s).trim())) : [];
    }

    const product = await Product.create({
      images,
      tryOnOverlay,
      title: title.trim(),
      description: description.trim(),
      category: (category != null ? String(category) : "").trim(),
      quantity: numQuantity,
      price: numPrice,
      seller: req.user._id,
      sizes,
    });

    const populated = await Product.findById(product._id).populate(
      "seller",
      "firstName lastName shopName profilePic city streetAddress"
    );
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// List all products (optional: ?sellerId=..., ?bestSeller=true, ?category=...)
exports.listProducts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.sellerId) filter.seller = req.query.sellerId;
    if (req.query.category) filter.category = req.query.category;
    
    let products;
    if (req.query.bestSeller === 'true') {
      // Get products from best sellers only
      const User = require("../models/User");
      const bestSellerIds = await User.find({ bestSeller: true }).select('_id');
      filter.seller = { $in: bestSellerIds.map(u => u._id) };
    }
    
    // Exclude current product if productId is provided
    if (req.query.excludeId) {
      filter._id = { $ne: req.query.excludeId };
    }
    
    products = await Product.find(filter)
      .populate("seller", "firstName lastName shopName profilePic city streetAddress bestSeller")
      .sort({ createdAt: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 100);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product (seller only)
exports.updateProduct = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can update products" });
    }

    const { name, title, description, category, quantity, price, sizes: sizesRaw } = req.body;
    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Find the product and verify ownership
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the product belongs to the current seller
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only update your own products" });
    }

    // Validate required fields
    if (!name || description === undefined || quantity === undefined || price === undefined) {
      return res.status(400).json({
        message: "name, description, quantity and price are required",
      });
    }

    const numQuantity = Number(quantity);
    const numPrice = Number(price);
    if (isNaN(numQuantity) || numQuantity < 0 || isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({
        message: "quantity and price must be non-negative numbers",
      });
    }

    // Update product fields
    const updateData = {
      name: name.trim(),
      title: title.trim() || name.trim(),
      description: description.trim(),
      category: category,
      quantity: numQuantity,
      price: numPrice,
    };

    // Handle sizes if provided
    if (sizesRaw) {
      try {
        const sizes = JSON.parse(sizesRaw);
        if (Array.isArray(sizes)) {
          updateData.sizes = sizes;
        }
      } catch (e) {
        console.log('Invalid sizes JSON:', e);
      }
    }

    const tryOnArr = req.files && req.files.tryOnOverlay ? req.files.tryOnOverlay : [];
    if (tryOnArr.length > 0 && tryOnArr[0].path) {
      updateData.tryOnOverlay = tryOnArr[0].path.replace(/\\/g, "/");
    } else if (req.body.removeTryOnOverlay === "true" || req.body.removeTryOnOverlay === true) {
      updateData.tryOnOverlay = "";
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    ).populate("seller category");

    if (!updatedProduct) {
      return res.status(500).json({ message: "Failed to update product" });
    }

    console.log('Product updated successfully:', updatedProduct);
    res.json(updatedProduct);

  } catch (error) {
    console.log('Update product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete product (seller only)
exports.deleteProduct = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can delete products" });
    }

    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Find product and verify ownership
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if product belongs to current seller
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own products" });
    }

    // Delete the product
    await Product.findByIdAndDelete(productId);

    console.log('Product deleted successfully:', productId);
    res.json({ message: "Product deleted successfully" });

  } catch (error) {
    console.log('Delete product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get single product by id
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "firstName lastName shopName profilePic email city streetAddress"
    );
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
