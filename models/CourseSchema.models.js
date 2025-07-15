import mongoose from 'mongoose';

const CourseEnrollmentSchema = new mongoose.Schema({
  courseName: {
    type: String,
    required: [true, 'courseName is must be string'],
    trim: true
  },
  duration: {
    type: Number,
    required: [true, 'duration is must be number']
  },
  practicalDays: {
    type: Number,
    required: [true, 'practicalDays is must be number']
  },
  theoryDays: {
    type: Number,
    required: [true, 'theoryDays is must be number']
  },
  fee: {
    type: Number,
    required: [true, 'fee is must be number']
  }
}, { timestamps: true });

export default mongoose.model('Course', CourseEnrollmentSchema);
