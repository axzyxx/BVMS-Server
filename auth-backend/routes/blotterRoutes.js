import express from "express";
import Blotter from "../models/Blotter.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// 🧩 Fix for ES module __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ====================================
   🔍 GET ALL BLOTTERS (with search & pagination)
   ==================================== */
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10, status, from, to } = req.query;
    const query = {};

    // search
    if (search) {
      query.$or = [
        { complainant: { $regex: search, $options: "i" } },
        { respondent: { $regex: search, $options: "i" } },
        { incident: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    // status filter
    if (status) query.status = status;

    // date range
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blotters = await Blotter.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Blotter.countDocuments(query);
    res.json({ data: blotters, total });
  } catch (err) {
    console.error("Error fetching blotters:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ➕ CREATE */
router.post("/", async (req, res) => {
  try {
    const blotter = new Blotter(req.body);
    const saved = await blotter.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Error creating blotter:", err);
    res.status(400).json({ message: err.message });
  }
});

/* ✏️ UPDATE */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Blotter.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error("Error updating blotter:", err);
    res.status(400).json({ message: err.message });
  }
});

/* 🗑️ DELETE */
router.delete("/:id", async (req, res) => {
  try {
    await Blotter.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting blotter:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ====================================
   🧾 GENERATE PDF REPORT
   ==================================== */
router.get("/report", async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const query = {};

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    if (status) query.status = status;

    const blotters = await Blotter.find(query).sort({ date: -1 });

    // 🗂️ Ensure temp folder exists
    const tempDir = path.join(__dirname, "../temp");
    fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `Barangay_Blotter_Report_${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // 🏛️ HEADER
    try {
      const logoPath = path.join(__dirname, "../public/logo.png");
      if (fs.existsSync(logoPath)) doc.image(logoPath, 50, 40, { width: 60 });
    } catch (e) {
      console.warn("Logo not found, skipping image header.");
    }

    doc
      .fontSize(18)
      .text("Republic of the Philippines", 130, 45)
      .text("Barangay Victory - Blotter Report", 130, 70)
      .moveDown()
      .fontSize(10)
      .text(`Generated on: ${new Date().toLocaleString()}`)
      .moveDown(1.5);

    // 📋 TABLE HEADER
    doc.font("Helvetica-Bold");
    doc.text("Ref#", 40, doc.y);
    doc.text("Complainant", 90, doc.y);
    doc.text("Respondent", 220, doc.y);
    doc.text("Incident", 350, doc.y);
    doc.text("Status", 500, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke();

    // 📄 TABLE DATA
    doc.font("Helvetica");
    blotters.forEach((b) => {
      doc.moveDown(0.3);
      doc.text(b.referenceNo || "—", 40);
      doc.text(b.complainant || "—", 90);
      doc.text(b.respondent || "—", 220);
      doc.text(b.incident?.slice(0, 30) || "—", 350);
      doc.text(b.status || "—", 500);
      if (doc.y > 750) doc.addPage(); // handle overflow
    });

    doc.end();

    writeStream.on("finish", () => {
      res.download(filePath, "Barangay_Blotter_Report.pdf", (err) => {
        if (!err) fs.unlinkSync(filePath);
      });
    });

    writeStream.on("error", (err) => {
      console.error("Error writing PDF:", err);
      res.status(500).json({ message: "Error generating report" });
    });
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: err.message });
  }
});

/* 📊 SUMMARY */
router.get("/summary", async (req, res) => {
  try {
    const summary = await Blotter.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



export default router;
