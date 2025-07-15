import User from "../models/userModel.js";
import Instructor from "../models/InstructorSchema.models.js";
import Learner from "../models/LearnerSchema.models.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
// import fast2sms from "fast-two-sms"; // Install using `npm install fast-two-sms`
import fs from "fs";
import { generateAdmissionNumber } from '../util/generateAdmissionNumber.js';
import {findLearnerFolderInDrive, uploadAndOverwriteFile, createDriveFolder,uploadInstructorFile,deleteFolderFromDrive ,deleteInstructorFileFromDrive} from "../util/googleDriveUpload.js";
import mongoose from 'mongoose';
// import DbConnection from "../config/db.js"; // your existing file
import { connectToDatabase } from "../config/db.js"; 

// <<<<<<<<<<<<< Instructor >>>>>>>>>>>>>>>

// 🔧 Reusable Validation & Cast Error Handler

const handleValidationError = (error, res) => {
  // console.log(error);
  
  const toTitleCase = (str) =>
    str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, " $1");

  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => {
      const field = toTitleCase(err.path || "Field");

      // ✅ Mongoose puts CastError inside ValidationError
      if (err.name === "CastError") {
        if (err.kind === "number") return `${field} must be a number`;
        if (err.kind === "ObjectId") return `${field} must be a valid ID`;
        return `${field} must be a valid ${err.kind}`;
      }

      // ✅ Handle regular ValidationError
      return `${field} is invalid: ${err.message}`;
    });

    return res.status(400).json({ message: "Validation failed", errors });
  }

  // ✅ Top-level CastError not inside ValidationError
  if (error.name === "CastError") {
    const field = toTitleCase(error.path || "Field");

    if (error.kind === "number") {
      return res.status(400).json({
        message: "Validation failed",
        errors: [`${field} must be a number`],
      });
    }

    return res.status(400).json({
      message: "Validation failed",
      errors: [`${field} must be a valid ${error.kind}`],
    });
  }

  // Fallback
  console.error("❌ Unhandled Error:", error);
  return res.status(500).json({ message: "Internal server error" });
};

// 📌 Create Instructor with error handling
const createInstructor = async (req, res) => {
  const { username, mobileNumber, password, role } = req.body;

  // Validate required fields
  if (!username || !mobileNumber || !password || !role) {
    return res.status(400).json({
      message: "Missing required fields",
      missingFields: {
        username: username !== undefined ? "Provided" : "Missing",
        mobileNumber: mobileNumber !== undefined ? "Provided" : "Missing",
        password: password !== undefined ? "Provided" : "Missing",
        role: role !== undefined ? "Provided" : "Missing",
      },
    });
  }

  try {
    if (role === "Admin") {
      return res.status(403).json({ message: "Cannot create admin" });
    }

    const newUser = new User({ username, mobileNumber, password, role });

    delete req.body.username;
    delete req.body.password;

    let newRoleData;

    if (role === "Instructor") {
      delete req.body.role;
      newRoleData = new Instructor({ ...req.body });
      newUser.refId = newRoleData._id;
      newRoleData.userId = newUser._id;

      const fileUrls = {};
      const fileFields = ["photo"];
      const uploadedFiles = []; // Store uploaded file details for rollback

      if (req.files) {
        for (const field of fileFields) {
          if (req.files[field]) {
            const file = req.files[field][0];

            // ✅ Generate a new file name
            const fileExtension = file.originalname.split(".").pop();
            const newFileName = `${field}_${newRoleData._id}`;

            file.originalname = newFileName; // Rename before upload

            // ✅ Upload file
            const uploadedFile = await uploadInstructorFile(file);
            fileUrls[field] = uploadedFile.webViewLink;
            uploadedFiles.push(uploadedFile.id); // Store fileId for rollback
          }
        }
      }

      newRoleData.photo = fileUrls["photo"];

      try {
        await newRoleData.save();
        await newUser.save();
        res.status(201).json({
          message: `${newUser.role} created successfully`,
          instructorData: newRoleData,
        });
      } catch (dbError) {
        // ❌ If MongoDB save fails, delete uploaded files
        for (const fileId of uploadedFiles) {
          await deleteInstructorFileFromDrive(fileId);
        }
        throw dbError;
      }
    } else {
      return res.status(500).json({ message: "Error creating user, role undefined" });
    }
  } catch (error) {
    handleValidationError(error, res);
  }
};





// 📌 READ ALL Instructors
const getAllInstructors = async (req, res) => {
  try {
    const { fromdate, todate, search, gender } = req.query;
        
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page; // Ensure page is always >= 1
    
    let limit = parseInt(req.query.limit, 10);
    limit = isNaN(limit) || limit < 1 ? 15 : limit; // Ensure limit is always >= 1
    
    
    let searchFilter = {};
    // Exclude instructor with _id: 67e84533440e905b74bb8763
    const excludeId = new mongoose.Types.ObjectId(process.env.AdminId); // Use AdminId from .env
    searchFilter._id = { $ne: excludeId }; 
    
    // Convert fromdate and todate to Date objects
    let fromDateObj = fromdate ? new Date(fromdate) : null;
    let toDateObj = todate ? new Date(todate) : null;

    if (toDateObj) {
      toDateObj.setHours(23, 59, 59, 999); // Include the full day
    }

    // Apply date filtering
    if (fromDateObj && toDateObj) {
      searchFilter.joinDate = { $gte: fromDateObj, $lte: toDateObj };
    }

    // Apply gender filtering if provided
    if (gender) {
      searchFilter.gender = gender;
    }

    // Apply search filter (if any)
    if (search) {
      const trimmedSearch = search.trim(); // Remove spaces from input search

      searchFilter.$or = [
        { fullName: { $regex: trimmedSearch, $options: "i" } },
        { mobileNumber: { $regex: trimmedSearch, $options: "i" } },
        { gender: { $regex: trimmedSearch, $options: "i" } },
        // { email: { $regex: trimmedSearch, $options: "i" } }
      ];
    }

    // Count total instructors (before pagination)
    const totalInstructors = await Instructor.countDocuments(searchFilter);

    // Apply pagination
    const instructors = await Instructor.find(searchFilter)
    .sort({ createdAt: -1 }) // Ensure LIFO order (latest first)
      .populate("userId", "username mobileNumber role password") // Keep existing populate
      .skip((page - 1) * limit) // Skip previous pages
      .limit(parseInt(limit)) // Limit per-page records
      // .lean(); // Convert to plain objects

 // Convert to plain objects and inject decrypted password
 const instructorsWithDecrypted = instructors.map((instructors) => {
  const instructorsObj = instructors.toObject();

  if (instructorsObj.userId && instructorsObj.userId.decryptedPassword) {
    // Replace encrypted password with decrypted one
    instructorsObj.userId.password = instructorsObj.userId.decryptedPassword;

    // Optionally remove decryptedPassword from output
    delete instructorsObj.userId.decryptedPassword;
  }

  return instructorsObj;
  });


    // Count instructors in the current page
    const currentInstructors = instructorsWithDecrypted.length;




    // Calculate total pages
    const totalPages = Math.ceil(totalInstructors / limit);

    // Send response
    res.status(200).json({
      totalPages,
      currentPage: parseInt(page),
      totalInstructors,
      currentInstructors, // ✅ New field added
      instructorsWithDecrypted,
    });

  }  catch (error) {
    handleValidationError(error, res);
  }
};





// 📌 GET Single Instructor by _id
const getInstructorById = async (req, res) => {
  try {
    const { _id } = req.params; // Get _id from request params

    // Find instructor by _id and populate user details
    const instructor = await Instructor.findById(_id).populate("userId", "username mobileNumber role password ");

    // If no instructor found, return 404
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
 // Convert to plain object
 const instructorsObj = instructor.toObject();

 // Replace encrypted password with decrypted password
 if (instructorsObj.userId && instructorsObj.userId.decryptedPassword) {
   instructorsObj.userId.password = instructorsObj.userId.decryptedPassword;
   delete instructorsObj.userId.decryptedPassword; // Optional: clean up
 }

    // Return the learners data
    res.status(200).json(instructorsObj);
    // Return the instructor data
    // res.status(200).json(instructor);
  }  catch (error) {
    handleValidationError(error, res);
  }
};



  // 📌 UPDATE Instructor

const updateInstructor = async (req, res) => {
  const { instructorId } = req.params;
  
  

  try {
    // ✅ Find the instructor
    const instructor = await Instructor.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    // ✅ Find the linked user
    const user = await User.findById(instructor.userId);
    if (!user) {
      return res.status(404).json({ message: "Linked user not found" });
    }

    // ✅ Update fields from request body (excluding `_id` and `userId`)
    Object.keys(req.body).forEach((key) => {
      if (key !== "_id" && key !== "userId") {
        instructor[key] = req.body[key];
      }
    });

    // ✅ File upload handling (overwriting existing files)
    if (req.files?.photo) {
      const file = req.files.photo[0];

      // 📌 Generate a consistent file name: "photo_instructorId"
      const newFileName = `photo_${instructorId}`;
      
      // ✅ Rename the file before uploading
      file.originalname = newFileName;

      // 📌 Upload and overwrite the file
      const uploadedFile = await uploadInstructorFile(file);
      instructor.photo = uploadedFile.webViewLink; // Update photo URL
    }


    
    
    // return 
    // ✅ Save updated instructor details
    await instructor.save();

    // ✅ Sync username and mobileNumber in the User collection
    if (req.body.username) user.username = req.body.username;
    if (req.body.mobileNumber) user.mobileNumber = req.body.mobileNumber; 
    if (req.body.password) user.password = req.body.password; 

    await user.save();

    res.status(200).json({ message: "Instructor updated successfully", instructor });

  }  catch (error) {
    handleValidationError(error, res);
  }
};




  // 📌 DELETE Instructor
  const deleteInstructor = async (req, res) => {
    try {
      const { _id } = req.params;
  
      const instructor = await Instructor.findById(_id);
      if (!instructor) {
        return res.status(404).json({ message: "Instructor not found" });
      }
  
      await User.findByIdAndDelete(instructor.userId); // Delete linked user
      await Instructor.findByIdAndDelete(_id);
  
      res.status(200).json({ message: "Instructor deleted successfully" });
    }  catch (error) {
    handleValidationError(error, res);
  }
  };
 
 
      // ✨ <<<<<<<<<<<<< Learner >>>>>>>>>>>>>>> ✨  

 
 
      //createLearner
  

  const createLearner = async (req, res) => {
      let session;
      let learnerFolderId;

   try {
    // ✅ Ensure DB connection is open
      await connectToDatabase(); 
   

    // ✅ Start DB session after ensuring connection
    session = await mongoose.startSession();
    session.startTransaction();

    const { username, mobileNumber, password, role } = req.body;

    if (!username || !mobileNumber || !password) {
      return res.status(400).json({ message: "Username, Mobile Number, and Password are required" });
    }

    if (role !== "Learner") {
      return res.status(403).json({ message: "Only Learners can be created" });
    }

    const existingLearner = await Learner.findOne({ mobileNumber });
    if (existingLearner) {
      return res.status(409).json({ message: "Learner with this mobile number already exists" });
    }

    const admissionNumber = await generateAdmissionNumber();

    try {
      learnerFolderId = await createDriveFolder(admissionNumber);
    } catch (err) {
      console.error("Error creating Drive folder:", err);
      return res.status(500).json({ message: "Failed to create Drive folder" });
    }

    const fileUrls = {};
    const fileFields = ["photo", "signature", "aadharCard", "educationCertificate", "passport", "notary"];

    if (req.files) {
      for (const field of fileFields) {
        if (req.files[field]) {
          const file = req.files[field][0];
          const fileExtension = file.originalname.split(".").pop();
          const newFileName = `${field}_${admissionNumber}`;
          file.originalname = newFileName;

          const uploadedFile = await uploadAndOverwriteFile(file, learnerFolderId);
          fileUrls[field] = uploadedFile.webViewLink;
        }
      }
    }

    const newLearner = new Learner({
      ...req.body,
      admissionNumber,
      folderId: learnerFolderId,
      userId: null,
      ...fileUrls,
    });

    const newUser = new User({ username, mobileNumber, password, role });
    newUser.refId = newLearner._id;
    newLearner.userId = newUser._id;

    await newLearner.save({ session });
    await newUser.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Learner created successfully",
      learnerId: newLearner._id,
      learnerData: newLearner,
    });

   } catch (error) {
   if (session) {
     await session.abortTransaction().catch(() => {});
     session.endSession();
   }
 
   if (learnerFolderId) {
     await deleteFolderFromDrive(learnerFolderId).catch(() => {});
   }
 
   // ✅ Handle Mongoose validation errors
   if (error.name === 'ValidationError') {
     const firstErrorKey = Object.keys(error.errors)[0];
     const errorMessage = error.errors[firstErrorKey].message;
     return res.status(400).json({ message: errorMessage });
   }
 
   // ✅ Handle Duplicate Key Error (E11000)
   if (error.code === 11000) {
     const field = Object.keys(error.keyPattern || {})[0]; // username or mobileNumber
     const value = error.keyValue ? error.keyValue[field] : '';
     return res.status(409).json({
       message: `Duplicate ${field}`,
       error: `The ${field} '${value}' is already in use.`,
     });
   }
    handleValidationError(error, res);
   }

  };


 // 📌 READ ALL Learners
    const getAllLearners = async (req, res) => {
    try {
    const { fromdate, todate, search, gender } = req.query;

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;

    const searchFilter = {};

    // Parse ISO dates like 2025-05-18
    const parseISODate = (str) => {
      const date = new Date(str);
      return isNaN(date.getTime()) ? null : date;
    };

    // Parse DD-MM-YYYY
    const parseDDMMYYYY = (str) => {
    if (!str || typeof str !== "string") return null;
    const parts = str.split("-");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    return isNaN(date.getTime()) ? null : date;
    };
  
  
  
      const fromDateObj = parseISODate(fromdate);
      const toDateObj = parseISODate(todate);
      if (toDateObj) toDateObj.setHours(23, 59, 59, 999);
  
      if (fromDateObj && toDateObj) {
        searchFilter.joinDate = { $gte: fromDateObj, $lte: toDateObj };
      }
  
      if (gender) {
        searchFilter.gender = { $regex: `^${gender}$`, $options: "i" };
      }
  
      // Check if search is a date (DD-MM-YYYY)
      const parsedSearchDate = parseDDMMYYYY(search);
  
      if (parsedSearchDate) {
        const startOfDay = new Date(parsedSearchDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(parsedSearchDate);
        endOfDay.setHours(23, 59, 59, 999);
  
        searchFilter.joinDate = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      } else if (search) {
        const trimmedSearch = search.trim();
        searchFilter.$or = [
          { fullName: { $regex: trimmedSearch, $options: "i" } },
          { mobileNumber: { $regex: trimmedSearch, $options: "i" } },
          { admissionNumber: { $regex: `^\\s*${trimmedSearch}$`, $options: "i" } },
        ];
      }
  
      const totalLearners = await Learner.countDocuments(searchFilter);
  
      let query = Learner.find(searchFilter)
        .populate("userId", "username mobileNumber role password")
        .sort({ createdAt: -1 });
  
      if (paginate) {
        query = query.skip((page - 1) * limit).limit(limit);
      }
  
      const learners = await query;
  
      const learnersWithDecrypted = learners.map((learner) => {
        const learnerObj = learner.toObject();
        if (learnerObj.userId && learnerObj.userId.decryptedPassword) {
          learnerObj.userId.password = learnerObj.userId.decryptedPassword;
          delete learnerObj.userId.decryptedPassword;
        }
        return learnerObj;
      });
  
      res.status(200).json({
        totalPages: paginate ? Math.ceil(totalLearners / limit) : 1,
        currentPage: paginate ? page : 1,
        totalLearners,
        currentLearners: learnersWithDecrypted.length,
        learners: learnersWithDecrypted,
      });
    } catch (error) {
      console.error("Error in getAllLearners:", error);
      res.status(500).json({
        message: "Server Error",
        error: error.message || error.toString(),
      });
    }
    };
  
 


  // 📌 GET Single Learners by _id
const getLearnersById = async (req, res) => {
  try {
    const { _id } = req.params; // Get _id from request params

    // Find instructor by _id and populate user details
    const learners = await Learner.findById(_id).populate("userId", "username mobileNumber role password");

    // If no learners found, return 404
    if (!learners) {
      return res.status(404).json({ message: "learners not found" });
    }
 // Convert to plain object
 const learnerObj = learners.toObject();

 // Replace encrypted password with decrypted password
 if (learnerObj.userId && learnerObj.userId.decryptedPassword) {
   learnerObj.userId.password = learnerObj.userId.decryptedPassword;
   delete learnerObj.userId.decryptedPassword; // Optional: clean up
 }

    // Return the learners data
    res.status(200).json(learnerObj);
  } catch (error) {
    handleValidationError(error, res);
  }
};

  
  // 📌 UPDATE Learner

 const updateLearner = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { admissionNumber } = req.params;
    const { password, mobileNumber, ...otherFields } = req.body;

    // 🔍 Find Learner
    const learner = await Learner.findOne({ admissionNumber }).session(session);
    if (!learner) {
      return res.status(404).json({ message: "Learner not found" });
    }

    // 🔍 Find User linked to this Learner
    const user = await User.findById(learner.userId).session(session);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔍 Find Learner's Google Drive Folder
    let learnerFolderId = await findLearnerFolderInDrive(admissionNumber);
    if (!learnerFolderId) {
      return res.status(404).json({ message: "Learner's folder not found in Google Drive" });
    }

    const updatedFields = {};
    const fileFields = ["photo", "signature", "aadharCard", "educationCertificate", "passport", "notary"];

    // 📂 Process File Uploads
    for (const field of fileFields) {
      if (req.files && req.files[field]) {
        const file = req.files[field][0];

        // ✅ Generate new filename (e.g., "photo_ADM202502.jpg")
        const fileExtension = file.originalname.split(".").pop();
        file.originalname = `${field}_${admissionNumber}`;

        // ✅ Upload and overwrite existing file
        const uploadedFile = await uploadAndOverwriteFile(file, learnerFolderId);

        // ✅ Store the new file URL
        updatedFields[field] = uploadedFile.webViewLink;
      }
    }

    // 📞 Ensure mobileNumber is updated in both collections
    if (mobileNumber && mobileNumber !== learner.mobileNumber) {
      const existingUser = await User.findOne({ mobileNumber }).session(session);
      if (existingUser) {
        return res.status(409).json({ message: "Mobile number already in use" });
      }
      learner.mobileNumber = mobileNumber;
      user.mobileNumber = mobileNumber;
    }

    // 📌 Update Learner Fields
    Object.assign(learner, updatedFields, otherFields);

    // 🔑 If password is provided, update it (schema will hash it)
    if (password) {
      user.password = password; // No manual hashing needed
    }

    // 🔄 Sync username with fullName
    user.username = learner.fullName;

    // ✅ Save Learner and User (triggers schema middleware for password hashing)
    await learner.save({ session });
    await user.save({ session });

    // ✅ Commit Transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Learner updated successfully", learner, user });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    handleValidationError(error, res);
    console.error("Error updating learner:", error);
    // res.status(500).json({ message: "Error updating learner", error: error.message });
  }
};

  

  // 📌 DELETE Learner
  const deleteLearner = async (req, res) => {
    try {
      const { _id } = req.params;
  
      const learner = await Learner.findById(_id);
      if (!learner) {
        return res.status(404).json({ message: "Learner not found" });
      }
  
      await User.findByIdAndDelete(learner.userId); // Delete linked user
      await Learner.findByIdAndDelete(_id);
  
      res.status(200).json({ message: "Learner deleted successfully" });
    }  catch (error) {
    handleValidationError(error, res);
  }
  };

 
export default {
  createInstructor,
  createLearner,
  getAllInstructors,
  getAllLearners,
  updateInstructor,
  updateLearner,
  deleteInstructor,
  deleteLearner,
  getInstructorById,
  getLearnersById
};
// export default { createUser };
