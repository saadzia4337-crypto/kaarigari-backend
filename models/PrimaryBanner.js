const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema({
  image: { type: String, default: "" },
  title: { type: String, default: "" },
  tagline: { type: String, default: "" },
  cta: { type: String, default: "" },
}, { _id: false });

const primaryBannerSchema = new mongoose.Schema(
  {
    slides: {
      type: [slideSchema],
      default: [],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length <= 3;
        },
        message: "Primary banner can have at most 3 slides",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PrimaryBanner", primaryBannerSchema);
