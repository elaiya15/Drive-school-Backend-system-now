import mongoose from 'mongoose';

const staffAttendanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'staff', // Reference to staff model
      required: [true, 'Staff is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    checkIn: {
      type: Date, // Stores full DateTime
    },
    checkOut: {
      type: Date, // Stores full DateTime (nullable)
    },
    status: {
      type: String,
      enum: {
        values: ['Present', 'Absent'],
        message: 'Status must be either Present or Absent',
      },
      required: [true, 'Status is required'],
    },
  },
  { timestamps: true }
);

export default mongoose.model('staffAttendance', staffAttendanceSchema);
