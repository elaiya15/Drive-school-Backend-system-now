import mongoose from 'mongoose'

const StaffSchema  = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    fathersName: {
        type: String,
        required: true,
        trim: true,
    },
    mobileNumber: {
        trim: true,
        type: String,
        required: true,
        unique: true,
        match: /^[0-9]{10}$/, // Regex for a 10-digit phone number
    },
    dateOfBirth: {
        trim: true,
        type: Date,
        required: true,
    },
    gender: {
        trim: true,
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
        required: true,
        trim: true,
    },
    address: {
        type: String,
        required: true,
        trim: true,
    },
    photo: {
        type: String, // URL or file path for the uploaded photo
        required: true,
    },
    joinDate: {  type: Date,
        default: Date.now,
        required: true},
    // userId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User' // Reference to the User model
    // }

}, { timestamps: true });

export default mongoose.model('Staff', StaffSchema );
