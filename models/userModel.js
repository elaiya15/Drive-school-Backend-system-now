import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {encryptPassword,decryptPassword} from '../util/encrypt.js'
import dotenv from "dotenv";

dotenv.config();

const userSchema = new mongoose.Schema(
    {
        username: { type: String, unique: true, sparse: true },
        mobileNumber: { type: String, unique: true, sparse: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['Admin', 'Learner', 'Instructor'], required: true },
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            // No `ref` or `refPath` here — you'll handle population manually
          },
        otp: { type: Number, default: null }, // Store OTP
        expiresAt: { type: Date, default: null }, // Store OTP expiry time
    },
    { timestamps: true }
);

// Middleware to hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await encryptPassword(this.password, process.env.JWT_SECRET);
    next();
});
// 👁️ Add virtual field to get decrypted password
userSchema.virtual("decryptedPassword").get(function () {
    try {
        return decryptPassword(this.password, process.env.JWT_SECRET);
    } catch (err) {
        return "Decryption Failed";
    }
});

// ✅ Ensure virtuals are included in outputs
userSchema.set("toObject", { virtuals: true });
userSchema.set("toJSON", { virtuals: true });

export default mongoose.model('User', userSchema);
