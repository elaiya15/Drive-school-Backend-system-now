import mongoose from 'mongoose';

const instructorSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full Name is required'],
    trim: true,
  },
  fathersName: {
    type: String,
    required: [true, "Father's Name is required"],
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile Number is required'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Mobile Number must be 10 digits'],
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of Birth is required'],
    trim: true,
  },
  gender: {
    type: String,
    enum: {
      values: ['Male', 'Female', 'Other'],
      message: 'Gender must be Male, Female, or Other',
    },
    required: [true, 'Gender is required'],
    trim: true,
  },
  bloodGroup: {
    type: String,
    enum: {
      values: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
      message: 'Invalid Blood Group',
    },
    required: [true, 'Blood Group is required'],
    trim: true,
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
  },
  photo: {
    type: String,
    required: [true, 'Photo is required'],
  },
  joinDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Join Date is required'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

export default mongoose.model('Instructor', instructorSchema);
