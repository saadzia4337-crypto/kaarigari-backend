const Cart = require("../models/Cart");
const Product = require("../models/Product");

/**
 * Get cart for the logged-in user. Populates product details.
 */
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "title price images seller quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add item to cart or increase qty. Body: { productId, qty (optional, default 1), size (optional), customSize (optional) }
 */
exports.addItem = async (req, res) => {
  try {
    const { productId, qty = 1, size, customSize } = req.body;
    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const numQty = Math.max(1, Number(qty) || 1);
    const sizeStr = size != null ? String(size).trim() : "";

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const existing = cart.items.find(
      (i) => i.product && i.product.toString() === productId && (i.size || "") === sizeStr
    );
    if (existing) {
      existing.qty += numQty;
    } else {
      cart.items.push({ product: productId, qty: numQty, size: sizeStr, customSize: customSize || null });
    }
    await cart.save();

    const populated = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "title price images seller quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Remove item from cart. Params: productId. Query: size (optional) – when provided, removes only the line with that size.
 */
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const size = req.query.size != null ? String(req.query.size).trim() : undefined;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.json({ user: req.user._id, items: [] });
    }
    cart.items = cart.items.filter((i) => {
      if (!i.product || i.product.toString() !== productId) return true;
      if (size !== undefined) return (i.size || "") !== size;
      return false;
    });
    await cart.save();

    const populated = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "title price images seller quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update item qty. Params: productId. Body: { qty, size (optional) }. If qty < 1, item is removed.
 */
exports.updateItemQty = async (req, res) => {
  try {
    const { productId } = req.params;
    const qty = Number(req.body.qty);
    const size = req.body.size != null ? String(req.body.size).trim() : "";
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const item = cart.items.find(
      (i) => i.product && i.product.toString() === productId && (i.size || "") === size
    );
    if (!item) {
      return res.status(404).json({ message: "Item not in cart" });
    }
    if (qty < 1) {
      cart.items = cart.items.filter(
        (i) => !(i.product && i.product.toString() === productId && (i.size || "") === size)
      );
    } else {
      item.qty = qty;
    }
    await cart.save();

    const populated = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "title price images seller quantity",
      populate: { path: "seller", select: "firstName lastName shopName profilePic city" },
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
