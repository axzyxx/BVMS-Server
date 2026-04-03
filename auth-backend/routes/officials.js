import express from "express";
import Official from "../models/Officials.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// ✅ GET all officials
router.get("/", async (req, res) => {
  try {
    const officials = await Official.find().sort({ createdAt: -1 });
    res.status(200).json(officials);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch officials", error: err.message });
  }
});

// ✅ POST add new official
router.post("/", async (req, res) => {
  try {
    const official = new Official(req.body);
    const savedOfficial = await official.save();
    
    // Log activity
    await logActivity(
      "official_added",
      "New Official Added",
      `${savedOfficial.firstName} ${savedOfficial.lastName} was added as ${savedOfficial.position}`,
      { officialId: savedOfficial._id, name: `${savedOfficial.firstName} ${savedOfficial.lastName}`, position: savedOfficial.position }
    );
    
    res.status(201).json(savedOfficial);
  } catch (err) {
    res.status(400).json({ message: "Failed to add official", error: err.message });
  }
});

// ✅ PUT update official by ID
router.put("/:id", async (req, res) => {
  try {
    const updated = await Official.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Official not found" });
    
    // Log activity
    await logActivity(
      "official_updated",
      "Official Updated",
      `${updated.firstName} ${updated.lastName}'s information was updated`,
      { officialId: updated._id, name: `${updated.firstName} ${updated.lastName}`, position: updated.position }
    );
    
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update official", error: err.message });
  }
});

// ✅ DELETE official by ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Official.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Official not found" });
    
    // Log activity
    await logActivity(
      "official_deleted",
      "Official Removed",
      `${deleted.firstName} ${deleted.lastName} (${deleted.position}) was removed`,
      { officialId: deleted._id, name: `${deleted.firstName} ${deleted.lastName}`, position: deleted.position }
    );
    
    res.status(200).json({ message: "Official deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete official", error: err.message });
  }
});

// 🆕 Backend route (server.js or routes/officials.js)
router.get("/old", async (req, res) => {
  try {
    const oldOfficials = await Official.find({ status: "Old" });
    res.json(oldOfficials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


export default router;
