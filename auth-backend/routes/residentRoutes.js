import express from "express";
import Resident from "../models/Resident.js";
import Official from "../models/Officials.js";
import DocumentRequest from "../models/DocumentRequest.js";
import bcrypt from "bcryptjs";
import { logActivity } from "../utils/activityLogger.js";
const router = express.Router();

/* ============================================================
   🧠 Helper: Normalize date safely
   ============================================================ */
const normalizeDate = (value) => {
  if (!value || value === "N/A" || value === "" || value === null) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const normalizePhone = (value = "") => {
  if (!value) return "";
  let digits = value.toString().replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  return digits.slice(0, 11);
};

const formatImageBase64 = (image) => {
  if (!image || !image.data) return null;
  try {
    return `data:${image.contentType || "image/png"};base64,${image.data.toString("base64")}`;
  } catch {
    return null;
  }
};

const formatResident = (resident) => {
  if (!resident) return null;
  const obj = resident.toObject ? resident.toObject() : { ...resident };
  obj.profileImageBase64 =
    obj.profileImageBase64 || formatImageBase64(obj.profileImage);
  obj.idPhotoBase64 =
    obj.idPhotoBase64 || formatImageBase64(obj.idPhoto);
  return obj;
};

/* ============================================================
   ✅ GET ALL RESIDENTS (OPTIMIZED)
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const { includeImages } = req.query;
    
    // Build query - exclude large image buffers unless explicitly requested
    let query = Resident.find().sort({ createdAt: -1 });
    
    if (includeImages !== 'true') {
      // Exclude image buffers for faster queries (base64 strings are still included)
      query = query.select('-idPhoto -profileImage');
    }
    
    // Use lean() for faster queries (returns plain JS objects, not Mongoose documents)
    const residents = await query.lean();
    
    // Only format images if requested, otherwise just return base64 if available
    const formatted = includeImages === 'true'
      ? residents.map(formatResident)
      : residents.map((r) => {
          const obj = { ...r };
          // Only include base64 if already present in DB, don't convert buffers
          obj.profileImageBase64 = r.profileImageBase64 || null;
          obj.idPhotoBase64 = r.idPhotoBase64 || null;
          return obj;
        });
    
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching residents:", err);
    res.status(500).json({ message: "Failed to fetch residents" });
  }
});

/* ============================================================
   ✅ ADD NEW RESIDENT (for admin panel)
   ============================================================ */
// ADD NEW RESIDENT (admin panel)
router.post("/", async (req, res) => {
  try {
    const data = { ...req.body };

    data.phone = normalizePhone(data.phone);
    if (!data.phone) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }

    // Auto-fill username and password if not provided
    if (!data.username) data.username = data.phone || `user${Date.now()}`;
    if (!data.password) data.password = "123456";

    // Normalize dates
    const normalizeDate = (value) => {
      if (!value || value === "N/A" || value === "" || value === null) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    };

    data.dateApplied = normalizeDate(data.dateApplied) || new Date();
    data.dateVerified = normalizeDate(data.dateVerified);

    // Check existing username or phone
    const existing = await Resident.findOne({
      $or: [{ username: data.username }, { phone: data.phone }],
    });

    if (existing) {
      return res.status(400).json({
        message: `A resident with this ${
          existing.username === data.username ? "username" : "phone number"
        } already exists.`,
      });
    }

    // Save resident
    const newResident = new Resident(data);
    const savedResident = await newResident.save();

    // Log activity
    await logActivity(
      "resident_added",
      "New Resident Added",
      `${savedResident.firstName} ${savedResident.lastName} was added to the system`,
      { residentId: savedResident._id, name: `${savedResident.firstName} ${savedResident.lastName}` }
    );

    res.status(201).json({
      message: "Resident added successfully",
      resident: formatResident(savedResident),
    });
  } catch (err) {
    console.error("Error adding resident:", err);
    res.status(500).json({ message: "Failed to add resident" });
  }
});


/* ============================================================
   ✅ UPDATE RESIDENT INFO
   ============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.phone) {
      updateData.phone = normalizePhone(updateData.phone);
      if (!updateData.phone) {
        return res.status(400).json({ message: "Valid phone number is required." });
      }
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
      updateData.passwordLegacy = false;
    }

    if (updateData.profileImageBase64) {
      try {
        const matches = updateData.profileImageBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const [, contentType, base64Data] = matches;
          updateData.profileImage = {
            data: Buffer.from(base64Data, "base64"),
            contentType: contentType || "image/png",
          };
        }
      } catch (err) {
        console.error("❌ Profile image parse error:", err);
      }
      delete updateData.profileImageBase64;
    }

    // Normalize date fields if present
    if (updateData.dateApplied)
      updateData.dateApplied = normalizeDate(updateData.dateApplied);
    if (updateData.dateVerified)
      updateData.dateVerified = normalizeDate(updateData.dateVerified);

    const updatedResident = await Resident.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedResident)
      return res.status(404).json({ message: "Resident not found" });

    // Log activity (only if significant changes were made)
    if (Object.keys(updateData).length > 0) {
      await logActivity(
        "resident_updated",
        "Resident Updated",
        `${updatedResident.firstName} ${updatedResident.lastName}'s information was updated`,
        { residentId: updatedResident._id, name: `${updatedResident.firstName} ${updatedResident.lastName}` }
      );
    }

    res.json({
      message: "✅ Resident updated successfully",
      resident: formatResident(updatedResident),
    });
  } catch (err) {
    console.error("❌ Update Resident Error:", err);
    res.status(500).json({ message: "Failed to update resident" });
  }
});

/* ============================================================
   ✅ APPROVE RESIDENT
   ============================================================ */
router.put("/:id/approve", async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident)
      return res.status(404).json({ message: "Resident not found" });

    // // Move ID image to profile image if exists
    // if (resident.idPhoto) {
    //   resident.profileImage = resident.idPhoto;
    //   resident.idPhoto = undefined;
    // }

    resident.status = "Active";
    resident.dateVerified = new Date(); // 🟢 Auto set when approved

    await resident.save();

    // Log activity
    await logActivity(
      "resident_approved",
      "Resident Approved",
      `${resident.firstName} ${resident.lastName} was approved and activated`,
      { residentId: resident._id, name: `${resident.firstName} ${resident.lastName}` }
    );

    res.json({ message: "✅ Resident approved", resident: formatResident(resident) });
  } catch (err) {
    console.error("❌ Approve Resident Error:", err);
    res.status(500).json({ message: "Approval failed" });
  }
});

/* ============================================================
   ✅ REJECT RESIDENT
   ============================================================ */
router.put("/:id/reject", async (req, res) => {
  try {
    const resident = await Resident.findByIdAndUpdate(
      req.params.id,
      { status: "Rejected" },
      { new: true }
    );
    if (!resident)
      return res.status(404).json({ message: "Resident not found" });

    // Log activity
    await logActivity(
      "resident_rejected",
      "Resident Rejected",
      `${resident.firstName} ${resident.lastName} was rejected`,
      { residentId: resident._id, name: `${resident.firstName} ${resident.lastName}` }
    );

    res.json({ message: "✅ Resident rejected", resident });
  } catch (err) {
    console.error("❌ Reject Resident Error:", err);
    res.status(500).json({ message: "Rejection failed" });
  }
});

/* ============================================================
   ✅ DELETE RESIDENT
   ============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Resident.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Resident not found" });

    res.json({ message: "✅ Resident deleted successfully" });
  } catch (err) {
    console.error("❌ Delete Resident Error:", err);
    res.status(500).json({ message: "Deletion failed" });
  }
});

/* ============================================================
   ✅ GET RESIDENT BY ID
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: "Resident not found" });
    }
    res.json(formatResident(resident));
  } catch (err) {
    console.error("❌ Error fetching resident by ID:", err);
    res.status(500).json({ message: "Failed to fetch resident" });
  }
});


/* ============================================================
   📊 GET DASHBOARD STATISTICS
   ============================================================ */
router.get("/stats/dashboard", async (req, res) => {
  try {
    // Total residents (Active only, exclude admin)
    const totalResidents = await Resident.countDocuments({ 
      status: "Active", 
      role: "resident" 
    });

    // Active officials
    const activeOfficials = await Official.countDocuments({ status: "Active" });

    // Senior citizens (age >= 60 or seniorCitizen === "Yes")
    const seniorCitizens = await Resident.countDocuments({
      $or: [
        { age: { $gte: 60 } },
        { seniorCitizen: { $regex: /^yes$/i } }
      ],
      status: "Active",
      role: "resident"
    });

    // PWD members
    const pwdMembers = await Resident.countDocuments({
      pwd: { $regex: /^yes$/i },
      status: "Active",
      role: "resident"
    });

    // 4Ps members
    const member4ps = await Resident.countDocuments({
      member4ps: { $regex: /^yes$/i },
      status: "Active",
      role: "resident"
    });

    // Male and Female counts
    const maleCount = await Resident.countDocuments({
      gender: "Male",
      status: "Active",
      role: "resident"
    });

    const femaleCount = await Resident.countDocuments({
      gender: "Female",
      status: "Active",
      role: "resident"
    });

    res.json({
      totalResidents,
      activeOfficials,
      seniorCitizens,
      pwdMembers,
      member4ps,
      maleCount,
      femaleCount,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
});

/* ============================================================
   📊 GET DASHBOARD CHART DATA
   ============================================================ */
router.get("/stats/chart", async (req, res) => {
  try {
    const { filter = "This Month" } = req.query;
    
    // Calculate date range based on filter
    const now = new Date();
    let startDate;
    
    if (filter === "This Month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === "Last 30 Days") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
    } else if (filter === "This Year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // Default to This Month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    // Count residents created in the period
    const residents = await Resident.countDocuments({
      createdAt: { $gte: startDate },
      role: "resident"
    });
    
    // Count active officials (or created in period if filter is "This Year")
    let officials;
    if (filter === "This Year") {
      officials = await Official.countDocuments({
        createdAt: { $gte: startDate }
      });
    } else {
      // For "This Month" and "Last 30 Days", show active officials
      officials = await Official.countDocuments({ status: "Active" });
    }
    
    // Count document requests created in the period
    const requests = await DocumentRequest.countDocuments({
      createdAt: { $gte: startDate }
    });
    
    // Count transactions (approved or printed document requests) in the period
    const transactions = await DocumentRequest.countDocuments({
      status: { $in: ["Approved", "Printed"] },
      updatedAt: { $gte: startDate }
    });
    
    res.json({
      residents,
      officials,
      requests,
      transactions,
    });
  } catch (err) {
    console.error("Error fetching chart data:", err);
    res.status(500).json({ message: "Failed to fetch chart data" });
  }
});

export default router;
