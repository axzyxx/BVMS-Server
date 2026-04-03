import mongoose from "mongoose";

const blotterSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, unique: true },
    complainant: { type: String, required: true, trim: true },
    complainantAddress: { type: String, trim: true },
    complainantResidentId: { type: String, trim: true, default: "" },
    respondent: { type: String, required: true, trim: true },
    respondentAddress: { type: String, trim: true },
    respondentResidentId: { type: String, trim: true, default: "" },
    witnesses: { type: String, trim: true },
    incident: { type: String, required: true, trim: true },
    narrative: { type: String, trim: true },
    incidentLocation: { type: String, trim: true },
    incidentTime: { type: String, trim: true },
    date: { type: Date, required: true },
    actionTaken: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// 🧠 Generate Reference Number automatically
blotterSchema.pre("save", async function (next) {
  if (this.referenceNo) return next();

  const year = new Date().getFullYear();
  const count = await mongoose.model("Blotter").countDocuments({
    createdAt: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) },
  });

  const sequence = String(count + 1).padStart(4, "0");
  this.referenceNo = `BLOT-${year}-${sequence}`;
  next();
});

export default mongoose.model("Blotter", blotterSchema);
