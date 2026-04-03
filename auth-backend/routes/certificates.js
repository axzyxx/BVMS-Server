import express from "express";
import Certificate from "../models/Certificate.js";

const router = express.Router();

// 🧾 Save Certificate
router.post("/", async (req, res) => {
  try {
    const certificate = new Certificate(req.body);
    await certificate.save();
    res.json({ message: "Certificate saved successfully" });
  } catch (err) {
    console.error("Error saving certificate:", err);
    res.status(500).json({ error: "Failed to save certificate" });
  }
});

// 📋 Get All Certificates
router.get("/", async (req, res) => {
  try {
    const certs = await Certificate.find().sort({ createdAt: -1 });
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
});

export default router;
