import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema({
  name: String,
  concern: String,
  date: String,
  issued: String,
  createdAt: { type: Date, default: Date.now },
});

const Certificate = mongoose.model("Certificate", certificateSchema);
export default Certificate;
