const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",   
  });
};

// SIGNUP
exports.signup = async (req, res) => {
  console.log("[auth] signup — request received, body keys:", req.body ? Object.keys(req.body) : "none");
  try {
    console.log("[auth] signup — payload:", { ...req.body, password: req.body?.password ? "***" : "", confirmPassword: req.body?.confirmPassword ? "***" : "" });
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }
    
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      role,
      streetNumber,
      city,
      bestSeller,
    } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save profile image path
    const profilePic = req.file ? req.file.path : "";

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      profilePic,
      role,
      streetNumber: streetNumber || "",
      city: city || "",
      bestSeller: role === "seller" && bestSeller === true,
    });

    const response = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic,
      shopName: user.shopName || "",
      bio: user.bio || "",
      streetNumber: user.streetNumber || "",
      city: user.city || "",
      bestSeller: user.bestSeller || false,
      token: generateToken(user._id),
    };
    console.log("[auth] signup — response 201:", { _id: response._id, email: response.email, role: response.role });
    res.status(201).json(response);
  } catch (error) {
    console.log("[auth] signup — error 500:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  console.log("[auth] login — request received");
  try {
    console.log("[auth] login — payload:", { email: req.body?.email, password: req.body?.password ? "***" : "" });
    if (!req.body) {
      console.log("[auth] login — response 400: Request body is missing");
      return res.status(400).json({ message: "Request body is missing" });
    }
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.log("[auth] login — response 400: Invalid credentials (user not found)");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("[auth] login — response 400: Invalid credentials (wrong password)");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const response = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic,
      shopName: user.shopName || "",
      bio: user.bio || "",
      streetNumber: user.streetNumber || "",
      city: user.city || "",
      bestSeller: user.bestSeller || false,
      token: generateToken(user._id),
    };
    console.log("[auth] login — response 200:", { _id: response._id, email: response.email, role: response.role });
    res.json(response);
  } catch (error) {
    console.log("[auth] login — error 500:", error.message);
    res.status(500).json({ message: error.message });
  }
};

const toUserResponse = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  profilePic: user.profilePic,
  shopName: user.shopName || "",
  bio: user.bio || "",
  streetNumber: user.streetNumber || "",
  city: user.city || "",
});

// UPDATE PROFILE (protected)
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, shopName, bio, streetNumber, city } = req.body;
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (req.file) updates.profilePic = req.file.path;
    if (streetNumber !== undefined) updates.streetNumber = streetNumber;
    if (city !== undefined) updates.city = city;
    if (req.user.role === "seller") {
      if (shopName !== undefined) updates.shopName = shopName;
      if (bio !== undefined) updates.bio = bio;
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select("-password");
    res.json(toUserResponse(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};