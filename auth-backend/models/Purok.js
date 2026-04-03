import mongoose from "mongoose";

const purokSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, unique: true },
    president: { type: String, trim: true },
    presidentPhone: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Purok", purokSchema);
