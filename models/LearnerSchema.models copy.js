import mongoose from "mongoose";

const learnerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    fathersName: { type: String, required: true, trim: true },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[0-9]{10}$/,
    },
    dateOfBirth: { type: Date, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true , trim: true,},
    bloodGroup: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    photo: { type: String, required: true },
    signature: { type: String, required: true },
    aadharCard: { type: String, required: true },
    educationCertificate: { type: String, required: true },
    passport: { type: String, required: true },
    notary: { type: String, required: true },
    licenseNumber: { type: String, default: null },
    llrNumber: { type: String, default: null },
    admissionNumber: { type: String, required: true, unique: true },
    joinDate: {  type: Date,
      default: Date.now,
      required: true},

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Learner", learnerSchema);
