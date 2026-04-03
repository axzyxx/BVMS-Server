import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/authRoutes.js";
import Resident from "./models/Resident.js"; 
import residentRoutes from "./routes/residentRoutes.js";
import purokRoutes from "./routes/puroks.js";
import officialsRoutes from "./routes/officials.js";
import blotterRoutes from "./routes/blotterRoutes.js";
import certificateRoutes from "./routes/certificates.js";
import announcementRoutes from "./routes/announcement.js";
import documentRequestRoutes from "./routes/documentRequests.js";
import activitiesRoutes from "./routes/activities.js";
import settingsRoutes from "./routes/settings.js";
import backupRoutes from "./routes/backup.js";
import reportRoutes from "./routes/reports.js";
import messagesRoutes from "./routes/messages.js";

import smsRouter from "./routes/smsRouter.js";

dotenv.config();
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit to handle base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/puroks", purokRoutes);
app.use("/api/officials", officialsRoutes);
app.use("/api/blotters", blotterRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/document-requests", documentRequestRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/messages", messagesRoutes);

app.use("/api/sms", smsRouter);

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Atlas Connected");

    // ✅ Auto-create Admin account if missing
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminUsername = process.env.ADMIN_USERNAME || "Admin";

    if (!adminPhone || !adminPassword) {
      console.warn("⚠️ ADMIN_PHONE or ADMIN_PASSWORD missing in .env");
    } else {
      const existingAdmin = await Resident.findOne({ phone: adminPhone });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = new Resident({
          firstName: "System",
          lastName: "Administrator",
          username: adminUsername,
          phone: adminPhone,
          password: hashedPassword,
          role: "admin",
          status: "Active",
        });
        await admin.save();
        console.log(`✅ Admin account created: ${adminPhone}`);
      } else {
        console.log(`👑 Admin account already exists: ${adminPhone}`);
      }
    }
  })
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
