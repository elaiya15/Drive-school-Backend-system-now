import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Learner",
      required: [true, "Learner is required"],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["Credit Card", "Debit Card", "UPI", "Net Banking", "Cash"],
        message: "Payment method must be one of: Credit Card, Debit Card, UPI, Net Banking, or Cash",
      },
      required: [true, "Payment method is required"],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be at least 1"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "CreatedBy (user) is required"],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index for performance on sorting by newest
PaymentSchema.index({ createdAt: -1 });

export default mongoose.model("Payment", PaymentSchema);
