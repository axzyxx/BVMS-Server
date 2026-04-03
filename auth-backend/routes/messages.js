import express from "express";
import Message from "../models/Message.js";
import Resident from "../models/Resident.js";

const router = express.Router();

// POST - Send message from user
router.post("/", async (req, res) => {
  try {
    const { residentId, message } = req.body;

    if (!residentId || !message || !message.trim()) {
      return res.status(400).json({ message: "Resident ID and message are required" });
    }

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: "Resident not found" });
    }

    const newMessage = new Message({
      resident: residentId,
      residentName: `${resident.firstName || ""} ${resident.lastName || ""}`.trim(),
      message: message.trim(),
      isReadByAdmin: false,
    });

    await newMessage.save();

    res.status(201).json({
      message: "Message sent successfully",
      data: {
        _id: newMessage._id,
        message: newMessage.message,
        reply: newMessage.reply,
        createdAt: newMessage.createdAt,
        isRead: newMessage.isRead,
      },
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// GET - Get messages for a specific resident
router.get("/", async (req, res) => {
  try {
    const { residentId } = req.query;

    if (!residentId) {
      return res.status(400).json({ message: "Resident ID is required" });
    }

    const messages = await Message.find({ resident: residentId })
      .sort({ createdAt: 1 })
      .lean();

    // Format messages with replies as separate messages
    const messagesWithReplies = [];
    messages.forEach((msg) => {
      // Add user message
      messagesWithReplies.push({
        id: msg._id.toString(),
        messageId: msg._id.toString(), // Store original message ID for marking as read
        sender: "user",
        text: msg.message,
        createdAt: msg.createdAt,
      });
      // Add admin reply if exists
      if (msg.reply) {
        messagesWithReplies.push({
          id: `${msg._id.toString()}-reply`,
          messageId: msg._id.toString(), // Store original message ID for marking as read
          sender: "admin",
          text: msg.reply,
          createdAt: msg.repliedAt || msg.updatedAt,
          isRead: msg.isRead || false,
        });
      }
    });

    res.json(messagesWithReplies);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// GET - Get all messages for admin (unread/new messages)
router.get("/admin", async (req, res) => {
  try {
    const messages = await Message.find({ isReadByAdmin: false })
      .sort({ createdAt: -1 })
      .populate("resident", "firstName lastName phone")
      .lean();

    const formatted = messages.map((msg) => ({
      _id: msg._id,
      residentId: msg.resident?._id || msg.resident,
      residentName: msg.residentName,
      message: msg.message,
      reply: msg.reply || null,
      hasReply: !!msg.reply,
      createdAt: msg.createdAt,
      repliedAt: msg.repliedAt,
      phone: msg.resident?.phone || "",
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching admin messages:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// POST - Admin replies to a message
router.post("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { reply, adminId } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.reply = reply.trim();
    message.repliedBy = adminId || null;
    message.repliedAt = new Date();
    message.isRead = false; // User hasn't read the reply yet

    await message.save();

    res.json({
      message: "Reply sent successfully",
      data: {
        _id: message._id,
        reply: message.reply,
        repliedAt: message.repliedAt,
      },
    });
  } catch (err) {
    console.error("Error replying to message:", err);
    res.status(500).json({ message: "Failed to send reply" });
  }
});

// PUT - Mark message as read by admin
router.put("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findByIdAndUpdate(
      id,
      { isReadByAdmin: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json({ message: "Message marked as read" });
  } catch (err) {
    console.error("Error marking message as read:", err);
    res.status(500).json({ message: "Failed to mark message as read" });
  }
});

// PUT - Mark reply as read by user
router.put("/:id/read-reply", async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json({ message: "Reply marked as read" });
  } catch (err) {
    console.error("Error marking reply as read:", err);
    res.status(500).json({ message: "Failed to mark reply as read" });
  }
});

export default router;

