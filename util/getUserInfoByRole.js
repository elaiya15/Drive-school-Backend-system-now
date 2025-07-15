import Instructor from "../models/InstructorSchema.models.js";
import Learner from "../models/LearnerSchema.models.js";



export const getUserInfoByRole = async (role, refId) => {
    if (!role || !refId) return null;
  
    switch (role) {
      case 'Admin':
        return await Instructor.findById(refId);
      case 'Instructor':
        return await Instructor.findById(refId);
      case 'Learner':
        return await Learner.findById(refId);
      default:
        return null;
    }
  };