import mongoose from "mongoose";

const learnerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, "fullName is required."],trim: true },
    fathersName: { type: String,required: [true, "fathersName is required."], trim: true },
    mobileNumber: {
      type: String,
     required: [true, "mobileNumber is required."],
      unique: true,
      trim: true,
      match: /^[0-9]{10}$/,
    },
    dateOfBirth: { type: Date, required: [true, "dateOfBirth is required."], trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: [true, "gender is required."], trim: true,},
   bloodGroup: { type: String, required: [true, "bloodGroup is required."], trim: true },
    address: { type: String, required: [true, "address is required."], trim: true },
    photo: { type: String, required: [true, "photo is required."] },
    signature: { type: String, required: [true, "signature is required."] },
    aadharCard: { type: String, required: [true, "aadharCard is required."] },
    educationCertificate: { type: String, required: [true, "educationCertificate is required."] },
    passport: { type: String, required: [true, "passport is required."] },
    notary: { type: String, required: [true, "notary is required."] },
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
