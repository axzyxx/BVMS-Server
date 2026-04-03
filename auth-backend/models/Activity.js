import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "resident_added",
        "resident_approved",
        "resident_rejected",
        "resident_updated",
        "official_added",
        "official_updated",
        "official_deleted",
        "announcement_posted",
        "announcement_deleted",
        "purok_added",
        "purok_updated",
        "purok_deleted",
        "document_approved",
        "document_printed",
        "document_request_cancelled",
      ],
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for faster queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1 });

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;

