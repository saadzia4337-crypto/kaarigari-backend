const mongoose = require("mongoose");

const sizeChartRowSchema = new mongoose.Schema(
  {
    measurementLabel: { type: String, default: "", trim: true },
    S: { type: String, default: "" },
    M: { type: String, default: "" },
    L: { type: String, default: "" },
  },
  { _id: false }
);

const sizeChartSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: { type: String, required: true, trim: true },
    rows: { type: [sizeChartRowSchema], default: [] },
    // legacy single row (for backward compat when reading old docs)
    measurementLabel: { type: String, default: "", trim: true },
    S: { type: String, default: "" },
    M: { type: String, default: "" },
    L: { type: String, default: "" },
  },
  { timestamps: true }
);

sizeChartSchema.index({ seller: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("SizeChart", sizeChartSchema);
