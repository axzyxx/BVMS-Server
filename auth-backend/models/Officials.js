import mongoose from "mongoose";

const OfficialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 18,
    },
    contact: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
     gender: {
      type: String,
      trim: true,
    },
    responsibilities: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    startTerm: {
      type: Date,
    },
    endTerm: {
      type: Date,
    },
    // 🆕 Add to your Mongoose Schema (if not yet)
status: {
  type: String,
  enum: ["Active", "Old"],
  default: "Active"
},

  },
  { timestamps: true }
);

export default mongoose.model("Official", OfficialSchema);
