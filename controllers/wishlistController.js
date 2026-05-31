const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

/**
 * Get wishlist for the logged-in user. Populates product details.
 */
exports.getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
      path: "products",
      select: "title price images seller description category quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add product to wishlist. Body: { productId }
 */
exports.addItem = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    const alreadyAdded = wishlist.products.some(
      (p) => p && p.toString() === productId
    );
    if (!alreadyAdded) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    const populated = await Wishlist.findById(wishlist._id).populate({
      path: "products",
      select: "title price images seller description category quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Remove product from wishlist. Params: productId
 */
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.json({ user: req.user._id, products: [] });
    }
    wishlist.products = wishlist.products.filter(
      (p) => p && p.toString() !== productId
    );
    await wishlist.save();

    const populated = await Wishlist.findById(wishlist._id).populate({
      path: "products",
      select: "title price images seller description category quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
