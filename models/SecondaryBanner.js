const mongoose = require("mongoose");

const secondaryBannerSchema = new mongoose.Schema(
  {
    image: { type: String, default: "" },
    title: { type: String, default: "" },
    tagline: { type: String, default: "" },
    subtext: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SecondaryBanner", secondaryBannerSchema);
