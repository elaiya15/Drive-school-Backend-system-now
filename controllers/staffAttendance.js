import StaffAttendance from '../models/staffAttendance.models.js';
import Staff from '../models/StaffSchema.models.js';
import {findLearnerFolderInDrive, uploadAndOverwriteFile, createDriveFolder,uploadInstructorFile,deleteFolderFromDrive ,deleteInstructorFileFromDrive} from "../util/googleDriveUpload.js";
import mongoose from 'mongoose';


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


// Create

export const createStaffAttendance = async (req, res) => {
  try {
    const { staff, date, status,checkIn,checkOut } = req.body;
   const createdBy= req.user.user_id

    const newAttendance = new StaffAttendance({
      staff,
      date,
      checkIn,
      checkOut ,
      status,
      createdBy,
    });

    await newAttendance.save();
    res.status(201).json({ message: 'staff attendance recorded successfully', data: newAttendance });
  } catch (error) {
    handleValidationError(error, res);
  }
};

// 📌 READ ALL or INDIVIDUAL Staff Attendances
export const getAllStaffAttendances = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const status = req.query.status || null;
    const staffId = req.params.id || null;
    const date =req.query.date ||null;

    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;

    let limit = parseInt(req.query.limit, 10);
    limit = isNaN(limit) || limit < 1 ? 15 : limit;

    const skip = (page - 1) * limit;

    let matchFilter = {};

    if (staffId) {
      matchFilter.staff = new mongoose.Types.ObjectId(staffId);
    }

    if (status) {
      matchFilter.status = { $regex: new RegExp(`^${status}$`, "i") };
    }

 
   // Try parsing search as date
   const isValidDate = (str) => {
    const parts = str.split("-");
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    return isNaN(date.getTime()) ? null : date;
  };

  const searchDate = isValidDate(search);

  if (fromdate && todate) {
    matchFilter.date = {
      $gte: new Date(`${fromdate}T00:00:00.000Z`),
      $lte: new Date(`${todate}T23:59:59.999Z`)
    };
  } else if (date) {
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const nextDate = new Date(parsedDate.getTime() + 86400000); // +1 day
    matchFilter.date = {
      $gte: parsedDate,
      $lt: nextDate,
    };
  } else if (searchDate) {
    // If search input looks like a date (DD-MM-YYYY), filter by that date
    matchFilter.date = {
      $gte: searchDate,
      $lt: new Date(searchDate.getTime() + 86400000),
    };
  }

    // 🔀 Handle /staff-attendance/:id with paginated records
    if (staffId) {
      const pipeline = [
        { $match: matchFilter },
        {
          $lookup: {
            from: "staffs",
            localField: "staff",
            foreignField: "_id",
            as: "staff",
          },
        },
        { $unwind: "$staff" },
        { $sort: { createdAt: -1 } }, // Sort before pagination
        {
          $facet: {
            metadata: [{ $count: "totalCount" }],
            data: [
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  date: 1,
                  checkIn: 1,
                  checkOut: 1,
                  status: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            staffInfo: {
              $first: "$data.staff",
            },
          },
        },
      ];

      const result = await StaffAttendance.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "staffs",
            localField: "staff",
            foreignField: "_id",
            as: "staff",
          },
        },
        { $unwind: "$staff" },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "totalCount" }],
            data: [
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  date: 1,
                  checkIn: 1,
                  checkOut: 1,
                  status: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
          },
        },
      ]);

      const paginatedRecords = result[0]?.data || [];
      const totalCount = result[0]?.metadata[0]?.totalCount || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Fetch staff info separately (not paginated)
      const staffInfo = await Staff.findById(staffId).lean();

      return res.status(200).json({
        success: true,
        currentPage: page,
        totalPages,
        totalCount,
        dataCount: paginatedRecords.length,
        staff: staffInfo,
        records: paginatedRecords,
      });
    }

    // 🔁 General list for all staff
    let baseMatch = matchFilter;

    if (search) {
      baseMatch = {
        ...matchFilter,
        $or: [
          { "staff.fullName": { $regex: search, $options: "i" } },
          { "staff.mobileNumber": { $regex: search, $options: "i" } },
          { "staff.gender": { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
          ...(searchDate
            ? [
                {
                  date: {
                    $gte: searchDate,
                    $lt: new Date(searchDate.getTime() + 86400000),
                  },
                },
              ]
            : []),
        ],
      };
    }

    const generalPipeline = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "staffs",
          localField: "staff",
          foreignField: "_id",
          as: "staff",
        },
      },
      { $unwind: "$staff" },
      { $match: baseMatch },
      {
        $project: {
          _id: 1,
          date: 1,
          checkIn: 1,
          checkOut: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "staff._id": 1,
          "staff.fullName": 1,
          "staff.mobileNumber": 1,
          "staff.gender": 1,
          "staff.email": 1,
          "staff.address": 1,
          "staff.photo": 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: "totalCount" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const result = await StaffAttendance.aggregate(generalPipeline);
    const attendances = result[0]?.data || [];
    const totalCount = result[0]?.metadata[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalCount,
      dataCount: attendances.length,
      data: attendances,
    });
  }catch (error) {
    handleValidationError(error, res);
  }
};


// Read One
export const getStaffAttendanceById = async (req, res) => {
  try {
    const attendance = await StaffAttendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance not found' });
    }
    res.status(200).json(attendance);
  } catch (error) {
    handleValidationError(error, res);
  }
};

// Update
export const updateStaffAttendance = async (req, res) => {
  try {
    const updatedAttendance = await StaffAttendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedAttendance) {
      return res.status(404).json({ error: 'Attendance not found' });
    }
    res.status(200).json(updatedAttendance);
  } catch (error) {
    handleValidationError(error, res);
  }
};

// Delete
export const deleteStaffAttendance = async (req, res) => {
  try {
    const deleted = await StaffAttendance.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Attendance not found' });
    }
    res.status(200).json({ message: 'Attendance deleted successfully' });
  } catch (error) {
    handleValidationError(error, res);
  }
};
