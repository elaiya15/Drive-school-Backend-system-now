import Staff from '../models/StaffSchema.models.js';
import {findLearnerFolderInDrive, uploadAndOverwriteFile, createDriveFolder,uploadStaffFile,deleteFolderFromDrive ,deleteStaffFileFromDrive} from "../util/googleDriveUpload.js";
import mongoose from 'mongoose';

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


// Create a new staff
export const createStaff = async (req, res) => {
  const session = await Staff.startSession();
  session.startTransaction();

  
  let uploadedFiles = [];

  try {
    const newStaff = new Staff(req.body);

    const fileUrls = {};
    const fileFields = ["photo"];

    // Upload files BEFORE saving staff
    if (req.files) {
      

      for (const field of fileFields) {
        if (req.files?.[field]?.[0]) {
          const file = req.files[field][0];
          

          const fileExtension = file.originalname.split(".").pop();
          const newFileName = `${field}_${newStaff._id || Date.now()}`;
          file.originalname = newFileName;

          const uploadedFile = await uploadStaffFile(file);
          fileUrls[field] = uploadedFile.webViewLink;
          uploadedFiles.push(uploadedFile.id);
        }
      }
    }

    // Set uploaded photo URL before validation/saving
    newStaff.photo = fileUrls["photo"];

    await newStaff.validate(); // Now it won't fail
    await newStaff.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Staff created successfully",
      data: newStaff,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Rollback: delete uploaded files
    for (const fileId of uploadedFiles) {
      await deleteStaffFileFromDrive(fileId);
    }

   handleValidationError(error, res);
  }
};

// 📌   // Get all staff members
export const getAllStaff = async (req, res) => {
  try {
    const { fromdate, todate, search, gender } = req.query;
        
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page; // Ensure page is always >= 1
    
    let limit = parseInt(req.query.limit, 10);
    limit = isNaN(limit) || limit < 1 ? 15 : limit; // Ensure limit is always >= 1
    
    
    let searchFilter = {};

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
      searchFilter.gender ={ $regex: gender.trim(), $options: "i" };
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
    const totalstaffList = await Staff.countDocuments(searchFilter);

    // Apply pagination
    const staffList = await Staff.find(searchFilter)
    .sort({ createdAt: -1 }) // Ensure LIFO order (latest first)
      // .populate("userId", "username mobileNumber role password") // Keep existing populate
      .skip((page - 1) * limit) // Skip previous pages
      .limit(parseInt(limit)) // Limit per-page records
      // .lean(); // Convert to plain objects


    // Count staffList in the current page
    const currentStaff = staffList.length;




    // Calculate total pages
    const totalPages = Math.ceil(totalstaffList / limit);

    // Send response
    res.status(200).json({
      totalPages,
      currentPage: parseInt(page),
      totalstaffList,
      currentStaff, // ✅ New field added
      staffList,
    });

  } catch (err) {
    handleValidationError(error, res);
  }
};


// Get single staff by ID
export const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.status(200).json({ success: true,  staff });
  } catch (error) {
   handleValidationError(error, res);
  }
};

// Update staff by ID
// export const updateStaff = async (req, res) => {
//   try {
//     const updatedStaff = await Staff.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, runValidators: true }
//     );
//     if (!updatedStaff) {
//       return res.status(404).json({ success: false, message: "Staff not found" });
//     }
//     res.status(200).json({ success: true, data: updatedStaff });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };
export const updateStaff = async (req, res) => {
  const session = await Staff.startSession();
  session.startTransaction();

  const uploadedFiles = []; // Track new uploads for rollback

  try {
    const { id } = req.params;
    // Step 1: Find existing staff
    const existingStaff = await Staff.findById(id).session(session);
    if (!existingStaff) {
      throw new Error("Staff not found");
    }

    // Step 2: Update plain fields
    const updatableFields = [
      "fullName",
      "fathersName",
      "mobileNumber",
      "dateOfBirth",
      "gender",
      "bloodGroup",
      "address",
      "joinDate",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingStaff[field] = req.body[field];
      }
    });

    const fileFields = ["photo"];
    const fileUrls = {};

    if (req.files) {
      for (const field of fileFields) {
        if (req.files[field]) {
          const file = req.files[field][0];

          // Set new filename
          const fileExtension = file.originalname.split(".").pop();
          const newFileName = `${field}_${existingStaff._id}`;
          file.originalname = newFileName;

          // Upload and get new link
          const uploadedFile = await uploadStaffFile(file);
          fileUrls[field] = uploadedFile.webViewLink;
          uploadedFiles.push(uploadedFile.id);

          // Replace old file URL with new one
          existingStaff[field] = fileUrls[field];
        }
      }
    }

    // Step 3: Save updated document
    await existingStaff.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Staff updated successfully",
      data: existingStaff,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Cleanup new uploaded files
    // for (const fileId of uploadedFiles) {
    //   await deleteFolderFromDrive(fileId);
    // }

    handleValidationError(error, res);
  }
};

// Delete staff by ID
export const deleteStaff = async (req, res) => {
  try {
    const deletedStaff = await Staff.findByIdAndDelete(req.params.id);
    if (!deletedStaff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.status(200).json({ success: true, message: "Staff deleted successfully" });
  } catch (error) {
    handleValidationError(error, res);
  }
};
