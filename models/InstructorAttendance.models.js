import mongoose from 'mongoose';

const InstructorAttendanceSchema = new mongoose.Schema(
  {
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instructor', // Reference to Instructor model
      required: [true, 'Instructor is required'],
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

export default mongoose.model('InstructorAttendance', InstructorAttendanceSchema);
