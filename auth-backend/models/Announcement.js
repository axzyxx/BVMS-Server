import mongoose from "mongoose";

const AnnouncementSchema = new mongoose.Schema({
  type: { type: String, required: true },
  messageType: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },

  audience: { type: String, required: true },
  recipient: { type: String, default: "All" },
  official: { type: String, default: "" },
  /** When audience is MembershipResident: All | 4PS | PWD | IPS | SeniorCitizen */
  membershipCategory: { type: String, default: "" },

  date: { type: Date, default: Date.now },

  smsSent: { type: Boolean, default: false },
  smsSentAt: { type: Date, default: null },
  /** Per-recipient results from last bulk SMS attempt */
  smsResult: { type: [mongoose.Schema.Types.Mixed], default: undefined },
});

// Prevent OverwriteModelError when hot-reloading or importing multiple times
export default mongoose.models.Announcement ||
  mongoose.model("Announcement", AnnouncementSchema);
