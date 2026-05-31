const SizeChart = require("../models/SizeChart");

function normalizeChartRows(chart) {
  const obj = chart.toObject ? chart.toObject() : { ...chart };
  if (obj.rows && Array.isArray(obj.rows) && obj.rows.length > 0) {
    return obj;
  }
  obj.rows = [
    {
      measurementLabel: obj.measurementLabel || "",
      S: obj.S || "",
      M: obj.M || "",
      L: obj.L || "",
    },
  ];
  return obj;
}

/**
 * GET /api/size-charts?sellerId= - list charts for a seller (public)
 */
exports.listBySeller = async (req, res) => {
  try {
    const { sellerId } = req.query;
    if (!sellerId) {
      return res.status(400).json({ message: "sellerId is required" });
    }
    const charts = await SizeChart.find({ seller: sellerId }).sort({ category: 1 });
    res.json(charts.map(normalizeChartRows));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/size-charts/by-seller-category?sellerId=&category= - single chart (public)
 */
exports.getBySellerAndCategory = async (req, res) => {
  try {
    const { sellerId, category } = req.query;
    if (!sellerId || !category) {
      return res.status(400).json({ message: "sellerId and category are required" });
    }
    const chart = await SizeChart.findOne({
      seller: sellerId,
      category: String(category).trim(),
    });
    if (!chart) {
      return res.status(404).json({ message: "Size chart not found" });
    }
    res.json(normalizeChartRows(chart));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/size-charts - create or replace chart (seller only). Upsert by seller + category.
 * Body: { category, rows: [{ measurementLabel, S, M, L }, ...] } or legacy { category, measurementLabel, S, M, L }
 */
function sanitizeRow(r) {
  return {
    measurementLabel: r?.measurementLabel != null ? String(r.measurementLabel).trim() : "",
    S: r?.S != null ? String(r.S).trim() : "",
    M: r?.M != null ? String(r.M).trim() : "",
    L: r?.L != null ? String(r.L).trim() : "",
  };
}

exports.create = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can manage size charts" });
    }
    const { category, rows: bodyRows, measurementLabel, S, M, L } = req.body;
    const cat = category != null ? String(category).trim() : "";
    if (!cat) {
      return res.status(400).json({ message: "category is required" });
    }
    let rows = [];
    if (Array.isArray(bodyRows) && bodyRows.length > 0) {
      rows = bodyRows.map(sanitizeRow);
    } else {
      rows = [
        sanitizeRow({
          measurementLabel,
          S,
          M,
          L,
        }),
      ];
    }
    const chart = await SizeChart.findOneAndUpdate(
      { seller: req.user._id, category: cat },
      { rows, measurementLabel: "", S: "", M: "", L: "" },
      { new: true, upsert: true }
    );
    res.status(201).json(normalizeChartRows(chart));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/size-charts/:id - update chart (seller only, owner only)
 */
exports.update = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can manage size charts" });
    }
    const chart = await SizeChart.findById(req.params.id);
    if (!chart) {
      return res.status(404).json({ message: "Size chart not found" });
    }
    if (chart.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this chart" });
    }
    const { category, rows: bodyRows } = req.body;
    if (category !== undefined) chart.category = String(category).trim();
    if (Array.isArray(bodyRows) && bodyRows.length > 0) {
      chart.rows = bodyRows.map(sanitizeRow);
      chart.measurementLabel = "";
      chart.S = chart.M = chart.L = "";
    }
    await chart.save();
    res.json(normalizeChartRows(chart));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/size-charts/:id - delete chart (seller only, owner only)
 */
exports.remove = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ message: "Only sellers can manage size charts" });
    }
    const chart = await SizeChart.findById(req.params.id);
    if (!chart) {
      return res.status(404).json({ message: "Size chart not found" });
    }
    if (chart.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this chart" });
    }
    await SizeChart.findByIdAndDelete(req.params.id);
    res.json({ message: "Size chart deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
