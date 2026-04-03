import express from "express";
import mongoose from "mongoose";
import Resident from "../models/Resident.js";
import Official from "../models/Officials.js";
import DocumentRequest from "../models/DocumentRequest.js";
import Announcement from "../models/Announcement.js";
import Purok from "../models/Purok.js";
import Activity from "../models/Activity.js";

const router = express.Router();

// GET backup data
router.get("/", async (req, res) => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      residents: await Resident.find({}).lean(),
      officials: await Official.find({}).lean(),
      documentRequests: await DocumentRequest.find({}).lean(),
      announcements: await Announcement.find({}).lean(),
      puroks: await Purok.find({}).lean(),
      activities: await Activity.find({}).lean(),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${Date.now()}.json"`);
    res.json(backupData);
  } catch (err) {
    console.error("Error creating backup:", err);
    res.status(500).json({ message: "Failed to create backup" });
  }
});

export default router;

