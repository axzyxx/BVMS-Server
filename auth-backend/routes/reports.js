import express from "express";
import Resident from "../models/Resident.js";
import Official from "../models/Officials.js";
import DocumentRequest from "../models/DocumentRequest.js";
import SystemSettings from "../models/SystemSettings.js";

const router = express.Router();

// GET comprehensive system report
router.get("/", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    
    const report = {
      generatedAt: new Date().toISOString(),
      barangayName: settings.barangayName,
      summary: {
        totalResidents: await Resident.countDocuments({ role: "resident", status: "Active" }),
        pendingResidents: await Resident.countDocuments({ role: "resident", status: "Pending" }),
        rejectedResidents: await Resident.countDocuments({ role: "resident", status: "Rejected" }),
        activeOfficials: await Official.countDocuments({ status: "Active" }),
        oldOfficials: await Official.countDocuments({ status: "Old" }),
        totalDocumentRequests: await DocumentRequest.countDocuments(),
        pendingDocuments: await DocumentRequest.countDocuments({ status: "Pending" }),
        approvedDocuments: await DocumentRequest.countDocuments({ status: "Approved" }),
        printedDocuments: await DocumentRequest.countDocuments({ status: "Printed" }),
      },
      demographics: {
        male: await Resident.countDocuments({ gender: "Male", role: "resident", status: "Active" }),
        female: await Resident.countDocuments({ gender: "Female", role: "resident", status: "Active" }),
        seniorCitizens: await Resident.countDocuments({
          $or: [{ age: { $gte: 60 } }, { seniorCitizen: { $regex: /^yes$/i } }],
          role: "resident",
          status: "Active",
        }),
        pwdMembers: await Resident.countDocuments({ pwd: { $regex: /^yes$/i }, role: "resident", status: "Active" }),
        member4ps: await Resident.countDocuments({ member4ps: { $regex: /^yes$/i }, role: "resident", status: "Active" }),
      },
      financial: {
        totalTransactions: await DocumentRequest.countDocuments({ status: { $in: ["Approved", "Printed"] } }),
        totalRevenue: await DocumentRequest.aggregate([
          { $match: { status: { $in: ["Approved", "Printed"] } } },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ]).then((result) => result[0]?.total || 0),
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="report-${Date.now()}.json"`);
    res.json(report);
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

export default router;

