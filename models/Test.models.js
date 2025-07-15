import mongoose from "mongoose";

const TestSchema = new mongoose.Schema(
  {
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Learner",
      required: [true, "Learner is required"]
    },
    testType: {
      type: String,
      enum: {
        values: ["Mock Test", "Theory Test", "Practical Test"],
        message: "Invalid test type"
      },
      required: [true, "Test type is required"]
    },
    date: {
      type: Date,
      required: [true, "Test date is required"]
    },
    result: {
      type: String,
      enum: {
        values: ["Pass", "Scheduled", "Fail"],
        message: "Invalid result"
      },
      default: "Scheduled"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Test", TestSchema);
