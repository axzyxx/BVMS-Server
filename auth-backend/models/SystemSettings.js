import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    systemName: {
      type: String,
      default: "Barangay Victory System",
      trim: true,
    },
    barangayName: {
      type: String,
      default: "Barangay Victory",
      trim: true,
    },
    logo: {
      data: Buffer,
      contentType: String,
    },
    logoBase64: {
      type: String,
      default: "",
    },
    systemLogoBase64: {
      type: String,
      default: "",
    },
    landingPageLogoBase64: {
      type: String,
      default: "",
    },
    splashLogoBase64: {
      type: String,
      default: "",
    },
    iconLogoBase64: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this({ 
      systemName: "Barangay Victory System",
      barangayName: "Barangay Victory" 
    });
    await settings.save();
  }
  return settings;
};

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
export default SystemSettings;

