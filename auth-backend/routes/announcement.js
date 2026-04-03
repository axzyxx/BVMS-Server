import express from "express";
import Announcement from "../models/Announcement.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// GET /api/announcements - fetch all announcements
router.get("/", async (req, res) => {
  try {
    const { audience, messageType } = req.query;
    let query = {};
    
    // Filter by audience if provided (for user-specific announcements)
    if (audience && audience !== "All") {
      query.$or = [
        { audience: "All" },
        { audience: audience },
        { recipient: audience }
      ];
    }
    
    // Filter by messageType if provided (for notifications)
    if (messageType) {
      query.messageType = messageType;
    }
    
    const announcements = await Announcement.find(query)
      .sort({ date: -1 })
      .limit(50);
    
    res.json(announcements);
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// POST /api/announcements - create a new announcement
router.post("/", async (req, res) => {
  try {
    const {
      type,
      messageType,
      title,
      message,
      audience,
      recipient,
      official,
      membershipCategory = "",
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    if (!["Announcement", "Alert", "Event"].includes(type)) {
      return res.status(400).json({ error: "Invalid announcement type" });
    }

    const newAnnouncement = new Announcement({
      type,
      messageType: messageType || "Text",
      title,
      message,
      audience: audience || "All",
      recipient: recipient || "All",
      official: official || "",
      membershipCategory:
        audience === "MembershipResident" ? membershipCategory || "All" : "",
      date: new Date(),
    });

    const saved = await newAnnouncement.save();
    
    // Log activity
    await logActivity(
      "announcement_posted",
      "Announcement Posted",
      `${type}: ${title}`,
      { announcementId: saved._id, type, messageType: messageType || "Text", title }
    );
    
    res.status(201).json(saved);
  } catch (err) {
    console.error("Error posting announcement:", err);
    res.status(500).json({ error: "Failed to post announcement" });
  }
});

// DELETE /api/announcements/:id - delete an announcement
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    await Announcement.findByIdAndDelete(id);
    
    // Log activity
    await logActivity(
      "announcement_deleted",
      "Announcement Deleted",
      `${announcement.type}: ${announcement.title}`,
      { announcementId: id, type: announcement.type, title: announcement.title }
    );
    
    res.json({ message: "Announcement deleted successfully" });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
