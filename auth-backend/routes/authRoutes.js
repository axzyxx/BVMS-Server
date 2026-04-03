import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import Resident from "../models/Resident.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const normalizePhone = (value = "") => {
  if (!value) return "";
  let digits = value.toString().replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  return digits.slice(0, 11);
};

const sanitizeInput = (value = "") => value.toString().trim();

const buildPhoneCandidates = (value = "") => {
  const normalized = normalizePhone(value);
  const candidates = new Set();
  if (normalized) candidates.add(normalized);

  const trimmed = sanitizeInput(value);
  if (trimmed) candidates.add(trimmed);

  const digits = value?.toString().replace(/\D/g, "") || "";
  if (digits) {
    candidates.add(digits);
    const localTen = digits.slice(-10);
    if (localTen.length === 10) {
      candidates.add(`0${localTen}`);
      candidates.add(`63${localTen}`);
      candidates.add(`+63${localTen}`);
    }
  }

  return { normalized, candidates: Array.from(candidates).filter(Boolean) };
};

// ✅ Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ REGISTER (for residents only)
router.post("/register", upload.single("idPhoto"), async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      username,
      password,
      confirmPassword,
      phone,
      address,
      civilStatus,
      gender,
      birthdate,
      age,
      occupation,
      purok,
      household,
      nationality,
      education,
      membership,
      religion,
    } = req.body;

    // Validation
    if (
      !firstName ||
      !lastName ||
      !username ||
      !password ||
      !confirmPassword ||
      !phone ||
      !purok ||
      !household ||
      !civilStatus ||
      !nationality ||
      !religion
    ) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    const cleanPassword = sanitizeInput(password);
    const cleanConfirmPassword = sanitizeInput(confirmPassword);

    if (cleanPassword !== cleanConfirmPassword)
      return res.status(400).json({ message: "Passwords do not match." });

    const { normalized: normalizedPhone, candidates: phoneCandidates } = buildPhoneCandidates(phone);

    if (!normalizedPhone || !phoneCandidates.length) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }

    const existing = await Resident.findOne({ phone: { $in: phoneCandidates } });
    if (existing)
      return res.status(400).json({ message: "Phone number already registered." });

    const idPhoto = req.file
      ? {
          data: req.file.buffer,
          contentType: req.file.mimetype,
        }
      : null;

    const newResident = new Resident({
      firstName,
      middleName,
      lastName,
      fullName: `${lastName} ${firstName} ${middleName}`.trim(),
      username: sanitizeInput(username),
      phone: normalizedPhone,
      password: cleanPassword,
      address,
      civilStatus,
      purok,
      household,
      gender,
      birthdate,
      age,
      occupation,
      idPhoto,          // ✅ connect ID photo
      nationality,
      education, // 🎓 Added
      membership,
      religion,
      role: "resident",
      status: "Pending", // ✅ new residents default to Pending
    });

    await newResident.save();

    res.status(201).json({
      message: "Registration successful. Awaiting admin approval.",
      resident: newResident, // include resident for front-end
    });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const cleanPassword = sanitizeInput(password);
    const { normalized: normalizedPhone, candidates: phoneCandidates } = buildPhoneCandidates(phone);

    if (!cleanPassword || !phoneCandidates.length)
      return res.status(400).json({ message: "All fields are required." });

  // First, try to find a resident in the database (including admin users stored in DB)
  let resident = await Resident.findOne({
      $or: [
        { phone: { $in: phoneCandidates } },
        { username: sanitizeInput(phone) },
      ],
    });

  // If no resident exists in DB, allow ENV-based admin login as a fallback only
  if (!resident) {
    const adminPhoneNormalized = normalizePhone(process.env.ADMIN_PHONE);
    if (
      normalizedPhone &&
      adminPhoneNormalized &&
      normalizedPhone === adminPhoneNormalized &&
      cleanPassword === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ phone, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1d" });
      return res.json({
        message: "Admin login successful",
        token,
        resident: { firstName: "Admin", lastName: "Account", phone, role: "admin", status: "Active" },
      });
    }

    return res.status(404).json({
      code: "ACCOUNT_NOT_FOUND",
      message: "No account is registered with that mobile number.",
    });
  }

    // Check if password is a valid bcrypt hash
    const bcryptHashRegex = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    const isBcryptHash = bcryptHashRegex.test(resident.password);
    
    let isMatch = false;
    
    if (isBcryptHash) {
      // Password is hashed, use bcrypt.compare
      isMatch = await bcrypt.compare(cleanPassword, resident.password);
    } else {
      // Password is not hashed (legacy), compare directly
      if (resident.password === cleanPassword) {
        // Auto-upgrade to bcrypt hash
        resident.password = await bcrypt.hash(cleanPassword, 10);
        resident.passwordLegacy = false;
        await resident.save();
        isMatch = true;
      } else if (resident.passwordLegacy) {
        // Try legacy password check
        isMatch = resident.password === cleanPassword;
        if (isMatch) {
          // Upgrade to bcrypt
          resident.password = await bcrypt.hash(cleanPassword, 10);
          resident.passwordLegacy = false;
          await resident.save();
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        code: "INCORRECT_PASSWORD",
        message: "Incorrect password. Please try again or reset it via Forgot Password.",
      });
    }

    if (resident.status !== "Active")
      return res.status(403).json({
        code: "NOT_ACTIVE",
        message: "Account awaiting admin approval.",
      });

    if (normalizedPhone && resident.phone !== normalizedPhone) {
      resident.phone = normalizedPhone;
      await resident.save();
    }

    const token = jwt.sign({ id: resident._id, role: resident.role || "user" }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      resident: {
        id: resident._id,
        firstName: resident.firstName,
        lastName: resident.lastName,
        phone: resident.phone,
        role: resident.role || "user",
        status: resident.status,
        roleLabel: resident.role === "admin" ? "Admin" : "Resident",
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ message: "Login failed." });
  }
});

// ✅ Request OTP for Password Reset
router.post("/request-otp", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = sanitizeInput(phone);

    if (!cleanPhone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    const { normalized, candidates } = buildPhoneCandidates(cleanPhone);
    if (!normalized || !candidates.length) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    const resident = await Resident.findOne({ phone: { $in: candidates } });
    if (!resident) {
      return res.status(404).json({ message: "Account not found for that number." });
    }

    // Import OTP storage
    const { storeOTP } = await import("../utils/otpStorage.js");
    const otpCode = storeOTP(normalized);

    // Send OTP via SMS
    try {
      const axios = (await import("axios")).default;
      const IPROG_BASE = "https://sms.iprogtech.com/api/v1";
      const IPROG_TOKEN = process.env.IPROG_API_TOKEN || "";
      const SMS_SENDER_NAME = process.env.SMS_SENDER_NAME || "Ka Prets";

      if (IPROG_TOKEN) {
        const smsMessage = `Your OTP code for password reset is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;
        const url = `${IPROG_BASE}/sms_messages`;
        
        try {
          const params = {
            api_token: IPROG_TOKEN,
            phone_number: normalized,
            message: smsMessage,
            sender_name: SMS_SENDER_NAME,
          };
          
          await axios.post(url, null, { 
            params, 
            timeout: 20000,
            headers: { 'Accept': 'application/json' }
          });
          console.log(`[OTP] OTP sent to ${normalized}`);
        } catch (smsErr) {
          console.error("[OTP] SMS sending failed:", smsErr?.response?.data || smsErr.message);
          // Continue even if SMS fails - OTP is still generated
        }
      } else {
        console.warn("[OTP] IPROG_API_TOKEN not set, OTP not sent via SMS");
      }
    } catch (smsErr) {
      console.error("[OTP] Error sending SMS:", smsErr);
      // Continue - OTP is still generated
    }

    res.json({ 
      message: "OTP code sent to your registered phone number.",
      // In development, you might want to return the OTP for testing
      // Remove this in production!
      ...(process.env.NODE_ENV === "development" && { otp: otpCode })
    });
  } catch (err) {
    console.error("❌ Request OTP Error:", err);
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

// ✅ Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    const cleanPhone = sanitizeInput(phone);
    const cleanOTP = sanitizeInput(otp);

    if (!cleanPhone || !cleanOTP) {
      return res.status(400).json({ message: "Phone number and OTP code are required." });
    }

    const { normalized } = buildPhoneCandidates(cleanPhone);
    if (!normalized) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    // Import OTP storage
    const { verifyOTP } = await import("../utils/otpStorage.js");
    const result = verifyOTP(normalized, cleanOTP);

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ 
      message: "OTP verified successfully. You can now reset your password.",
      verified: true
    });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err);
    res.status(500).json({ message: "Failed to verify OTP." });
  }
});

// ✅ Reset Password (after OTP verification)
router.post("/reset-password", async (req, res) => {
  try {
    const { phone, otp, password, confirmPassword } = req.body || {};
    const cleanPhone = sanitizeInput(phone);
    const cleanOTP = sanitizeInput(otp);
    const cleanPassword = sanitizeInput(password);
    const cleanConfirm = sanitizeInput(confirmPassword);

    if (!cleanPhone || !cleanOTP || !cleanPassword || !cleanConfirm) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (cleanPassword !== cleanConfirm) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (cleanPassword.length < 8 || !/[0-9]/.test(cleanPassword) || !/[a-zA-Z]/.test(cleanPassword)) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters with letters and numbers." });
    }

    const { normalized, candidates } = buildPhoneCandidates(cleanPhone);
    if (!normalized || !candidates.length) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    // Verify OTP - check if already verified or verify now
    const { verifyOTP, isOTPVerified, deleteOTP } = await import("../utils/otpStorage.js");
    
    // Verify OTP (this function handles both verified and unverified cases)
    const otpResult = verifyOTP(normalized, cleanOTP);
    
    if (!otpResult.valid) {
      return res.status(400).json({ message: otpResult.message });
    }
    
    // Ensure OTP is verified before proceeding
    if (!isOTPVerified(normalized)) {
      return res.status(400).json({ message: "OTP verification required. Please verify your OTP code first." });
    }

    const resident = await Resident.findOne({ phone: { $in: candidates } });
    if (!resident) {
      return res.status(404).json({ message: "Account not found for that number." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    
    // Update resident password using findByIdAndUpdate to ensure atomic update
    const updatedResident = await Resident.findByIdAndUpdate(
      resident._id,
      {
        phone: normalized,
        password: hashedPassword,
        passwordLegacy: false,
      },
      { new: true } // Return updated document
    );
    
    if (!updatedResident) {
      console.error("[Reset Password] Failed to update resident");
      return res.status(500).json({ message: "Failed to save password. Please try again." });
    }
    
    // Verify the password was saved correctly by comparing
    const verifyPassword = await bcrypt.compare(cleanPassword, updatedResident.password);
    if (!verifyPassword) {
      console.error("[Reset Password] Password hash verification failed after save");
      return res.status(500).json({ message: "Failed to save password. Please try again." });
    }
    
    console.log(`[Reset Password] Password successfully reset for phone: ${normalized}`);

    // Delete OTP after successful password reset
    deleteOTP(normalized);

    res.json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

// ✅ Forgot Password / Reset (Legacy - kept for backward compatibility)
router.post("/forgot-password", async (req, res) => {
  try {
    const { phone, password, confirmPassword } = req.body || {};
    const cleanPhone = sanitizeInput(phone);
    const cleanPassword = sanitizeInput(password);
    const cleanConfirm = sanitizeInput(confirmPassword);

    if (!cleanPhone || !cleanPassword || !cleanConfirm) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (cleanPassword !== cleanConfirm) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (cleanPassword.length < 8 || !/[0-9]/.test(cleanPassword) || !/[a-zA-Z]/.test(cleanPassword)) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters with letters and numbers." });
    }

    const { normalized, candidates } = buildPhoneCandidates(cleanPhone);
    if (!normalized || !candidates.length) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    const resident = await Resident.findOne({ phone: { $in: candidates } });
    if (!resident) {
      return res.status(404).json({ message: "Account not found for that number." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    
    resident.phone = normalized;
    resident.password = hashedPassword;
    resident.passwordLegacy = false;
    await resident.save();

    res.json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({ message: "Failed to reset password." });
  }
});



// GET all residents (for admin panel)
router.get("/residents", async (req, res) => {
  try {
    const residents = await Resident.find();

    // Convert Buffer to Base64 for images
    const processed = residents.map((r) => {
      const obj = r.toObject();

      return {
        ...obj,
        idPhotoBase64: r.idPhoto
          ? `data:${r.idPhoto.contentType};base64,${r.idPhoto.data.toString("base64")}`
          : null,
        profileImageBase64: r.profileImage
          ? `data:${r.profileImage.contentType};base64,${r.profileImage.data.toString("base64")}`
          : null,
      };
    });

    res.json(processed);
  } catch (err) {
    console.error("Failed to fetch residents:", err);
    res.status(500).json({ message: "Server error fetching residents." });
  }
});



export default router;
