import express from "express";
import SystemSettings from "../models/SystemSettings.js";
import multer from "multer";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Multiple file upload for different logo types
const uploadMultiple = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
}).fields([
  { name: 'systemLogo', maxCount: 1 },
  { name: 'landingPageLogo', maxCount: 1 },
  { name: 'splashLogo', maxCount: 1 },
  { name: 'iconLogo', maxCount: 1 },
  { name: 'logo', maxCount: 1 } // Keep for backward compatibility
]);

// Helper to format image to base64
const formatImageBase64 = (image) => {
  if (!image || !image.data) return null;
  const base64 = image.data.toString("base64");
  const contentType = image.contentType || "image/png";
  return `data:${contentType};base64,${base64}`;
};

// GET system settings
router.get("/", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const formatted = {
      systemName: settings.systemName || "Barangay Victory System",
      barangayName: settings.barangayName || "Barangay Victory",
      logoBase64: settings.logoBase64 || formatImageBase64(settings.logo),
      systemLogoBase64: settings.systemLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      landingPageLogoBase64: settings.landingPageLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      splashLogoBase64: settings.splashLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      iconLogoBase64: settings.iconLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
    };
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// UPDATE system settings
router.put("/", uploadMultiple, async (req, res) => {
  try {
    const { systemName, barangayName } = req.body;
    const settings = await SystemSettings.getSettings();

    if (systemName !== undefined) {
      settings.systemName = systemName;
    }

    if (barangayName !== undefined) {
      settings.barangayName = barangayName;
    }

    // Handle system logo
    if (req.files && req.files.systemLogo && req.files.systemLogo[0]) {
      const file = req.files.systemLogo[0];
      const base64 = file.buffer.toString("base64");
      settings.systemLogoBase64 = `data:${file.mimetype};base64,${base64}`;
    }

    // Handle landing page logo
    if (req.files && req.files.landingPageLogo && req.files.landingPageLogo[0]) {
      const file = req.files.landingPageLogo[0];
      const base64 = file.buffer.toString("base64");
      settings.landingPageLogoBase64 = `data:${file.mimetype};base64,${base64}`;
    }

    // Handle splash logo
    if (req.files && req.files.splashLogo && req.files.splashLogo[0]) {
      const file = req.files.splashLogo[0];
      const base64 = file.buffer.toString("base64");
      settings.splashLogoBase64 = `data:${file.mimetype};base64,${base64}`;
    }

    // Handle icon logo (favicon)
    if (req.files && req.files.iconLogo && req.files.iconLogo[0]) {
      const file = req.files.iconLogo[0];
      const base64 = file.buffer.toString("base64");
      settings.iconLogoBase64 = `data:${file.mimetype};base64,${base64}`;
    }

    // Backward compatibility: handle single logo upload
    if (req.files && req.files.logo && req.files.logo[0]) {
      const file = req.files.logo[0];
      settings.logo = {
        data: file.buffer,
        contentType: file.mimetype,
      };
      const base64 = file.buffer.toString("base64");
      settings.logoBase64 = `data:${file.mimetype};base64,${base64}`;
      // If no specific logos are set, use this as default for all
      if (!settings.systemLogoBase64) settings.systemLogoBase64 = settings.logoBase64;
      if (!settings.landingPageLogoBase64) settings.landingPageLogoBase64 = settings.logoBase64;
      if (!settings.splashLogoBase64) settings.splashLogoBase64 = settings.logoBase64;
      if (!settings.iconLogoBase64) settings.iconLogoBase64 = settings.logoBase64;
    }

    await settings.save();

    const formatted = {
      systemName: settings.systemName || "Barangay Victory System",
      barangayName: settings.barangayName || "Barangay Victory",
      logoBase64: settings.logoBase64 || formatImageBase64(settings.logo),
      systemLogoBase64: settings.systemLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      landingPageLogoBase64: settings.landingPageLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      splashLogoBase64: settings.splashLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
      iconLogoBase64: settings.iconLogoBase64 || settings.logoBase64 || formatImageBase64(settings.logo),
    };

    res.json({
      message: "Settings updated successfully",
      settings: formatted,
    });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;

