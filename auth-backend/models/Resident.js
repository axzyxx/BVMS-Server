import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const residentSchema = new mongoose.Schema(
  {
    /* ============================================================
       👤 BASIC PERSONAL INFORMATION
    ============================================================ */
    firstName: { type: String, trim: true, default: "" },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    fullName: { type: String, trim: true, default: "" },
    birthdate: { type: Date, default: null },
    placeOfBirth: { type: String, trim: true, default: "" },
    age: { type: Number, default: 0 },
    gender: { type: String, enum: ["Male", "Female", "N/A"], default: "N/A" },
    civilStatus: {
      type: String,
      enum: ["Single", "Married", "Widowed", "Separated", "Divorced", "N/A"],
      default: "N/A",
    },
    nationality: { type: String, trim: true, default: "N/A" },
    religion: { type: String, trim: true, default: "N/A" },

    /* ============================================================
       🏠 CONTACT & ADDRESS DETAILS
    ============================================================ */
    address: { type: String, trim: true, default: "" },
    purok: { type: String, trim: true, default: "N/A" },
    phone: { type: String, required: true, unique: true, trim: true },
    /* ============================================================
       🎓 EMPLOYMENT & EDUCATION
    ============================================================ */
    education: { type: String, trim: true, default: "N/A" },
    occupation: { type: String, trim: true, default: "N/A" },

    /* ============================================================
       👨‍👩‍👧‍👦 FAMILY DETAILS
    ============================================================ */
    householdNumber: { type: String, trim: true, default: "N/A" }, // shared per family
    headOfFamily: { type: String, trim: true, default: "N/A" },
    householdHeadName: { type: String, trim: true, default: "N/A" },
    relationshipToHead: { type: String, trim: true, default: "N/A" },

    /* ============================================================
       🚨 EMERGENCY CONTACT
    ============================================================ */
    emergencyPerson: { type: String, trim: true, default: "" },
    emergencyRelation: { type: String, trim: true, default: "" },
    emergencyNumber: { type: String, trim: true, default: "" },

    /* ============================================================
       📝 APPLICATION VERIFICATION
    ============================================================ */
    applicantSignature: { type: String, trim: true, default: "" },
    dateApplied: { type: Date, default: null },
    verifiedBy: { type: String, trim: true, default: "" },
    positionOfVerifier: { type: String, trim: true, default: "" },
    dateVerified: { type: Date, default: null },

    /* ============================================================
       🧩 SPECIAL MEMBERSHIPS / STATUS
    ============================================================ */
    pwd: { type: String, trim: true, default: "No" },
    member4ps: { type: String, trim: true, default: "No" },
    memberIps: { type: String, trim: true, default: "No" },
    seniorCitizen: { type: String, trim: true, default: "No" },

    /* ============================================================
       🔐 ACCOUNT CREDENTIALS
    ============================================================ */
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    passwordLegacy: { type: Boolean, default: true },

    /* ============================================================
       🖼️ IMAGES
    ============================================================ */
    profileImage: {
      data: Buffer,
      contentType: String,
    },
    idPhoto: {
      data: Buffer,
      contentType: String,
    },

    /* ============================================================
       ⚙️ ROLE & STATUS
    ============================================================ */
    role: {
      type: String,
      enum: ["resident", "admin"],
      default: "resident",
    },
    status: {
      type: String,
      enum: ["Pending", "Active", "Rejected", "Transferred"],
      default: "Pending",
    },

    /* ============================================================
       🕒 TIMESTAMP
    ============================================================ */
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "residents" }
);

/* ============================================================
   🧠 AUTO-GENERATE fullName, age, & shared householdNumber
============================================================ */
residentSchema.pre("save", async function (next) {
  // Auto full name
  this.fullName = [this.firstName, this.middleName, this.lastName]
    .filter(Boolean)
    .join(" ");

  // Auto age from birthdate
  if (this.birthdate) {
    const today = new Date();
    const birth = new Date(this.birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    this.age = age;
  } else {
    this.age = 0;
  }

  // 🆕 Shared household number logic
  if (!this.householdNumber || this.householdNumber === "N/A") {
    const Resident = mongoose.model("Resident");

    // Look for an existing household by headOfFamily or householdHeadName
    const existingHousehold = await Resident.findOne({
      $or: [
        { headOfFamily: this.headOfFamily },
        { householdHeadName: this.householdHeadName },
      ],
      householdNumber: { $ne: "N/A" },
    });

    if (existingHousehold) {
      // ✅ Use existing household number
      this.householdNumber = existingHousehold.householdNumber;
    } else {
      // 🆕 Generate new one
      const lastResident = await Resident.findOne({})
        .sort({ createdAt: -1 })
        .lean();

      let nextNumber = 1;

      if (
        lastResident &&
        lastResident.householdNumber &&
        lastResident.householdNumber.startsWith("HH-")
      ) {
        const lastNum = parseInt(lastResident.householdNumber.split("-")[1], 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }

      this.householdNumber = `HH-${String(nextNumber).padStart(3, "0")}`;
    }
  }

  // 🔒 Hash password if new or modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordLegacy = false;
  }

  next();
});

/* ============================================================
   🔐 PASSWORD VERIFICATION HELPER
============================================================ */
residentSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Resident = mongoose.model("Resident", residentSchema);
export default Resident;
