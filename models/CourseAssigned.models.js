import mongoose from 'mongoose';

const CourseAssignedSchema = new mongoose.Schema(
  {
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Learner',
      required: true,
    },
    course: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Course', 
      required: true 
    },
    statusOne: { 
      type: String, 
      enum: ['Completed', 'Processing', 'Cancelled'], 
      default: 'Processing' 
    },
    statusTwo: { 
      type: String, 
      enum: ["Ready to test",'Extra class'], 
      default: null, // Ensures no default value
      // select: false // Prevents it from being included in queries unless explicitly requested
    }
  }, 
  { timestamps: true }
);

// Indexing for optimized queries
CourseAssignedSchema.index({ learner: 1, course: 1 });

export default mongoose.model('CourseAssigned', CourseAssignedSchema);
