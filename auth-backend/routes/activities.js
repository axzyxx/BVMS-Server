import express from "express";
import Activity from "../models/Activity.js";

const router = express.Router();

// GET recent activities
router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(activities);
  } catch (err) {
    console.error("Error fetching activities:", err);
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// DELETE all activities
router.delete("/", async (req, res) => {
  try {
    const result = await Activity.deleteMany({});
    res.json({ 
      message: "All activities deleted successfully",
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("Error deleting activities:", err);
    res.status(500).json({ message: "Failed to delete activities" });
  }
});

export default router;

