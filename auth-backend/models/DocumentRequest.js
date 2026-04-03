import mongoose from "mongoose";

const documentRequestSchema = new mongoose.Schema(
  {
    resident: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    residentName: { type: String, required: true },
    documentType: { type: String, required: true },
    purpose: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "Pickup" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Printed"],
      default: "Pending",
    },
    adminNotes: { type: String, default: "" },
    receivedIdentification: {
      idType: { type: String, default: "" },
      idNumber: { type: String, default: "" },
      receiverName: { type: String, default: "" },
    },
    receivedAt: Date,
    residentSnapshot: {
      firstName: String,
      lastName: String,
      age: String,
      gender: String,
      civilStatus: String,
      purok: String,
      address: String,
      phone: String,
    },
    printedAt: Date,
  },
  { timestamps: true }
);

const DocumentRequest = mongoose.model("DocumentRequest", documentRequestSchema);
export default DocumentRequest;

