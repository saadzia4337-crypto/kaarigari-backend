const PrimaryBanner = require("../models/PrimaryBanner");
const SecondaryBanner = require("../models/SecondaryBanner");

// ----- Primary Banner -----

exports.getPrimaryBanner = async (req, res) => {
  try {
    let doc = await PrimaryBanner.findOne();
    if (!doc) {
      doc = await PrimaryBanner.create({ slides: [] });
    }
    res.json({ slides: doc.slides || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePrimaryBanner = async (req, res) => {
  try {
    let doc = await PrimaryBanner.findOne();
    if (!doc) {
      doc = await PrimaryBanner.create({ slides: [] });
    }
    const files = req.files || {};
    const slides = [];
    for (let i = 0; i < 3; i++) {
      const fileKey = `image${i}`;
      const file = files[fileKey] && files[fileKey][0] ? files[fileKey][0] : null;
      const image = file ? file.path : (doc.slides[i] && doc.slides[i].image) || "";
      const title = req.body[`title${i}`] !== undefined ? String(req.body[`title${i}`]) : (doc.slides[i] && doc.slides[i].title) || "";
      const tagline = req.body[`tagline${i}`] !== undefined ? String(req.body[`tagline${i}`]) : (doc.slides[i] && doc.slides[i].tagline) || "";
      const cta = req.body[`cta${i}`] !== undefined ? String(req.body[`cta${i}`]) : (doc.slides[i] && doc.slides[i].cta) || "";
      slides.push({ image, title, tagline, cta });
    }
    doc.slides = slides;
    await doc.save();
    res.json({ slides: doc.slides });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ----- Secondary Banner -----

exports.getSecondaryBanner = async (req, res) => {
  try {
    let doc = await SecondaryBanner.findOne();
    if (!doc) {
      doc = await SecondaryBanner.create({});
    }
    res.json({
      image: doc.image || "",
      title: doc.title || "",
      tagline: doc.tagline || "",
      subtext: doc.subtext || "",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSecondaryBanner = async (req, res) => {
  try {
    let doc = await SecondaryBanner.findOne();
    if (!doc) {
      doc = await SecondaryBanner.create({});
    }
    if (req.file && req.file.path) {
      doc.image = req.file.path;
    }
    if (req.body.title !== undefined) doc.title = String(req.body.title);
    if (req.body.tagline !== undefined) doc.tagline = String(req.body.tagline);
    if (req.body.subtext !== undefined) doc.subtext = String(req.body.subtext);
    await doc.save();
    res.json({
      image: doc.image || "",
      title: doc.title || "",
      tagline: doc.tagline || "",
      subtext: doc.subtext || "",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
