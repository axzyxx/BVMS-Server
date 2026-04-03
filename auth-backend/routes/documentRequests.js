import express from "express";
import DocumentRequest from "../models/DocumentRequest.js";
import Resident from "../models/Resident.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

const normalizePhone = (value = "") => {
  if (!value) return "";
  let digits = value.toString().replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  return digits.slice(0, 11);
};

const formatRequest = (request) => {
  if (!request) return null;
  const obj = request.toObject ? request.toObject() : { ...request };
  if (!obj.residentSnapshot && obj.resident) {
    obj.residentSnapshot = {
      firstName: obj.resident.firstName,
      lastName: obj.resident.lastName,
      age: obj.resident.age,
      gender: obj.resident.gender,
      civilStatus: obj.resident.civilStatus,
      purok: obj.resident.purok,
      address: obj.resident.address,
      phone: obj.resident.phone,
    };
  }
  return obj;
};

// 🆕 Create document request
router.post("/", async (req, res) => {
  try {
    const {
      residentId,
      documentType,
      purpose,
      quantity = 1,
      price = 0,
      paymentMethod = "Pickup",
    } = req.body;

    if (!residentId || !documentType || !purpose) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: "Resident not found." });
    }

    const snapshot = {
      firstName: resident.firstName,
      lastName: resident.lastName,
      age: resident.age ? String(resident.age) : "",
      gender: resident.gender || "",
      civilStatus: resident.civilStatus || "",
      purok: resident.purok || "",
      address: resident.address || "",
      phone: normalizePhone(resident.phone),
    };

    const request = new DocumentRequest({
      resident: resident._id,
      residentName: `${resident.firstName || ""} ${resident.lastName || ""}`.trim(),
      documentType,
      purpose,
      quantity,
      price,
      paymentMethod,
      residentSnapshot: snapshot,
    });

    await request.save();

    res.status(201).json({
      message: "Document request submitted.",
      request: formatRequest(request),
    });
  } catch (err) {
    console.error("❌ Create document request error:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

// 📋 Get document requests (optional filters)
router.get("/", async (req, res) => {
  try {
    const { residentId, status } = req.query;
    const query = {};

    if (residentId) query.resident = residentId;
    if (status) query.status = status;

    const requests = await DocumentRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("resident", "firstName lastName phone");

    res.json(requests.map(formatRequest));
  } catch (err) {
    console.error("❌ Fetch document requests error:", err);
    res.status(500).json({ message: "Failed to fetch requests." });
  }
});

// 🔄 Update request status
router.put("/:id/status", async (req, res) => {
  try {
    const { status, adminNotes, receivedIdentification } = req.body;
    const allowed = ["Pending", "Approved", "Printed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const update = {
      status,
      updatedAt: new Date(),
    };

    if (adminNotes !== undefined) {
      update.adminNotes = adminNotes;
    }

    if (status === "Printed") {
      update.printedAt = new Date();
      if (receivedIdentification !== undefined) {
        const normalized = {
          idType: (receivedIdentification?.idType || "").trim(),
          idNumber: (receivedIdentification?.idNumber || "").trim(),
          receiverName: (receivedIdentification?.receiverName || "").trim(),
        };
        if (!normalized.idType || !normalized.idNumber || !normalized.receiverName) {
          return res.status(400).json({
            message: "Resident identification (ID type, ID number, and receiver name) is required when marking as Printed.",
          });
        }
        update.receivedIdentification = normalized;
        update.receivedAt = new Date();
      }
    }

    const updated = await DocumentRequest.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Request not found." });
    }

    // Log activity for approval and printing
    if (status === "Approved") {
      await logActivity(
        "document_approved",
        "Document Request Approved",
        `${updated.documentType} request from ${updated.residentName} was approved`,
        { requestId: updated._id, documentType: updated.documentType, residentName: updated.residentName }
      );
    } else if (status === "Printed") {
      await logActivity(
        "document_printed",
        "Document Printed",
        `${updated.documentType} for ${updated.residentName} was printed`,
        { requestId: updated._id, documentType: updated.documentType, residentName: updated.residentName }
      );
    }

    res.json({
      message: "Request updated.",
      request: formatRequest(updated),
    });
  } catch (err) {
    console.error("❌ Update request status error:", err);
    res.status(500).json({ message: "Failed to update request." });
  }
});

// 🗑️ Resident cancels own pending request
router.delete("/:id", async (req, res) => {
  try {
    const { residentId } = req.query;
    if (!residentId) {
      return res.status(400).json({ message: "residentId is required." });
    }

    const doc = await DocumentRequest.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (String(doc.resident) !== String(residentId)) {
      return res.status(403).json({ message: "You cannot remove this request." });
    }

    if (doc.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending requests can be removed. Contact the barangay if you need help.",
      });
    }

    await DocumentRequest.findByIdAndDelete(req.params.id);

    await logActivity(
      "document_request_cancelled",
      "Document Request Cancelled",
      `${doc.documentType} request by ${doc.residentName} was cancelled by the resident`,
      { requestId: doc._id, documentType: doc.documentType, residentName: doc.residentName }
    );

    res.json({ message: "Request removed." });
  } catch (err) {
    console.error("❌ Delete document request error:", err);
    res.status(500).json({ message: "Failed to remove request." });
  }
});

// 💰 Get all transactions (approved/printed document requests)
router.get("/transactions", async (req, res) => {
  try {
    const transactions = await DocumentRequest.find({
      status: { $in: ["Approved", "Printed"] }
    })
      .sort({ createdAt: -1 })
      .populate("resident", "firstName lastName phone");

    const formattedTransactions = transactions.map((txn) => ({
      id: txn._id,
      name: txn.residentName || `${txn.residentSnapshot?.firstName || ""} ${txn.residentSnapshot?.lastName || ""}`.trim(),
      document: txn.documentType,
      amount: txn.price || 0,
      payment: txn.paymentMethod || "Pickup",
      date: txn.createdAt ? new Date(txn.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      status: txn.status,
      createdAt: txn.createdAt,
    }));

    res.json(formattedTransactions);
  } catch (err) {
    console.error("❌ Fetch transactions error:", err);
    res.status(500).json({ message: "Failed to fetch transactions." });
  }
});

export default router;

