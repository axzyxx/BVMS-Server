import express from "express";
import Purok from "../models/Purok.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// GET all puroks
router.get("/", async (req, res) => {
  try {
    const puroks = await Purok.find().sort({ createdAt: 1 });
    res.json(puroks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new purok
router.post("/", async (req, res) => {
  const { name, president, presidentPhone } = req.body;
  if (!name || !president || !presidentPhone)
    return res.status(400).json({ message: "Name, President, and Phone required" });

  try {
    const exists = await Purok.findOne({ name });
    if (exists) return res.status(400).json({ message: "Purok already exists" });

    const newPurok = new Purok({ name, president, presidentPhone });
    const savedPurok = await newPurok.save();
    
    // Log activity
    await logActivity(
      "purok_added",
      "New Purok Added",
      `Purok "${name}" with president "${president}" was added`,
      { purokId: savedPurok._id, name, president, presidentPhone }
    );
    
    res.status(201).json(savedPurok);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE purok
router.put("/:id", async (req, res) => {
  const { name, president, presidentPhone } = req.body;
  if (!president || !presidentPhone)
    return res.status(400).json({ message: "President and Phone required" });

  try {
    const updated = await Purok.findByIdAndUpdate(
      req.params.id,
      { ...(name && { name }), president, presidentPhone },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Purok not found" });

    await logActivity(
      "purok_updated",
      "Purok Updated",
      `Purok "${updated.name}" details were updated`,
      {
        purokId: updated._id,
        name: updated.name,
        president: updated.president,
        presidentPhone: updated.presidentPhone,
      }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a purok
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Purok.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Purok not found" });
    
    // Log activity
    await logActivity(
      "purok_deleted",
      "Purok Removed",
      `Purok "${deleted.name}" was removed`,
      { purokId: deleted._id, name: deleted.name }
    );
    
    res.json({ message: "Purok removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
