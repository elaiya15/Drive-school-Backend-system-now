import InstructorAttendance from '../models/InstructorAttendance.models.js';
import Instructors from '../models/InstructorSchema.models.js';
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


// ✅ Create Instructor Attendance
export const createInstructorAttendance = async (req, res) => {
  try {
    const { instructor, date, status,checkIn,checkOut } = req.body;

    const newAttendance = new InstructorAttendance({
      instructor,
      date,
      checkIn,
      checkOut ,
      status,
    });

    await newAttendance.save();
    res.status(201).json({ message: 'Instructor attendance recorded successfully', data: newAttendance });
  } catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Get All Instructor Attendances
// export const getAllInstructorAttendances = async (req, res) => {
//   try {
//     const search = req.query.search?.trim() || "";
//     const fromdate = req.query.fromdate || null;
//     const todate = req.query.todate || null;
//     const status = req.query.status || null;
//     const staffId = req.params.id || null;
//     const date =req.query.date ||null;

//     let page = parseInt(req.query.page, 10);
//     page = isNaN(page) || page < 1 ? 1 : page;

//     let limit = parseInt(req.query.limit, 10);
//     limit = isNaN(limit) || limit < 1 ? 15 : limit;

//     const skip = (page - 1) * limit;

//     let matchFilter = {};

//     if (staffId) {
//       matchFilter.instructor = new mongoose.Types.ObjectId(staffId);
//     }

//     if (status) {
//       matchFilter.status = { $regex: new RegExp(`^${status}$`, "i") };
//     }

//    // Try parsing search as date
//    const isValidDate = (str) => {
//     const parts = str.split("-");
//     if (parts.length !== 3) return null;
//     const [dd, mm, yyyy] = parts.map(Number);
//     const date = new Date(yyyy, mm - 1, dd);
//     return isNaN(date.getTime()) ? null : date;
//   };

//   const searchDate = isValidDate(search);

//   if (fromdate && todate) {
//     matchFilter.date = {
//       $gte: new Date(`${fromdate}T00:00:00.000Z`),
//       $lte: new Date(`${todate}T23:59:59.999Z`)
//     };
//   } else if (date) {
//     const parsedDate = new Date(`${date}T00:00:00.000Z`);
//     const nextDate = new Date(parsedDate.getTime() + 86400000); // +1 day
//     matchFilter.date = {
//       $gte: parsedDate,
//       $lt: nextDate,
//     };
//   } else if (searchDate) {
//     // If search input looks like a date (DD-MM-YYYY), filter by that date
//     matchFilter.date = {
//       $gte: searchDate,
//       $lt: new Date(searchDate.getTime() + 86400000),
//     };
//   }

//  matchFilter.status= { status: { $regex: search, $options: "i" } }


//     // const searchDate = !isNaN(Date.parse(search)) ? new Date(search) : null;

//     // 🔀 Handle /staff-attendance/:id with paginated records
//     if (staffId) {

//       const result = await InstructorAttendance.aggregate([
//         { $match: matchFilter },
//         {
//           $lookup: {
//             from: "instructors",
//             localField: "instructor",
//             foreignField: "_id",
//             as: "instructor"
//           }
//         },
//         { $unwind: "$instructor" },
//         { $sort: { createdAt: -1 } },
//         {
//           $facet: {
//             metadata: [{ $count: "totalCount" }],
//             data: [
//               { $skip: skip },
//               { $limit: limit },
//               {
//                 $project: {
//                   _id: 1,
//                   date: 1,
//                   checkIn: 1,
//                   checkOut: 1,
//                   status: 1,
//                   createdAt: 1,
//                   updatedAt: 1,
//                 },
//               },
//             ],
//           },
//         },
//       ]);

//       const paginatedRecords = result[0]?.data || [];
//       const totalCount = result[0]?.metadata[0]?.totalCount || 0;
//       const totalPages = Math.ceil(totalCount / limit);

//       // Fetch staff info separately (not paginated)
//       const instructorInfo = await Instructors.findById(staffId).lean();

//       return res.status(200).json({
//         success: true,
//         currentPage: page,
//         totalPages,
//         totalCount,
//         dataCount: paginatedRecords.length,
//         instructors: instructorInfo,
//         records: paginatedRecords,
//       });
//     }

//     // 🔁 General list for all staff
//     let baseMatch = matchFilter;

//     if (search) {
//       baseMatch = {
//         ...matchFilter,
//         $or: [
//           { "instructor.fullName": { $regex: search, $options: "i" } },
//           { "instructor.mobileNumber": { $regex: search, $options: "i" } },
//           { "instructor.gender": { $regex: search, $options: "i" } },
//           { status: { $regex: search, $options: "i" } },
//           ...(searchDate
//             ? [
//                 {
//                   date: {
//                     $gte: searchDate,
//                     $lt: new Date(searchDate.getTime() + 86400000),
//                   },
//                 },
//               ]
//             : []),
//         ],
//       };
//     }

//     const generalPipeline = [
//       {
//         $lookup: {
//           from: "instructors",
//           localField: "instructor",
//           foreignField: "_id",
//           as: "instructor"
//         }
//       },
//       { $unwind: "$instructor" },
//       { $match: baseMatch },
//       { $sort: { createdAt: -1 } },
//       {
//         $project: {
//           _id: 1,
//           date: 1,
//           checkIn: 1,
//           checkOut: 1,
//           status: 1,
//           createdAt: 1,
//           updatedAt: 1,
//           "instructor._id": 1,
//           "instructor.fullName": 1,
//           "instructor.mobileNumber": 1,
//           "instructor.gender": 1,
//           "instructor.email": 1,
//           "instructor.address": 1,
//           "instructor.photo": 1,
//         },
//       },
//       {
//         $facet: {
//           metadata: [{ $count: "totalCount" }],
//           data: [{ $skip: skip }, { $limit: limit }],
//         },
//       },
//     ];

//     const result = await InstructorAttendance.aggregate(generalPipeline);
//     const attendances = result[0]?.data || [];
//     const totalCount = result[0]?.metadata[0]?.totalCount || 0;
//     const totalPages = Math.ceil(totalCount / limit);

//     return res.status(200).json({
//       success: true,
//       currentPage: page,
//       totalPages,
//       totalCount,
//       dataCount: attendances.length,
//       data: attendances,
//     });
//   } catch (error) {
//     handleValidationError(error, res);
//   }
// };
export const getAllInstructorAttendances = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const status = req.query.status || null;
    const staffId = req.params.id || null;
    const date = req.query.date || null;

    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;

    let limit = parseInt(req.query.limit, 10);
    limit = isNaN(limit) || limit < 1 ? 15 : limit;

    const skip = (page - 1) * limit;

    let matchFilter = {};

    // ✅ Validate staffId
    if (staffId) {
      if (mongoose.Types.ObjectId.isValid(staffId)) {
        matchFilter.instructor = new mongoose.Types.ObjectId(staffId);
      } else {
        return res.status(400).json({ error: "Invalid instructor ID" });
      }
    }

    if (status) {
      matchFilter.status = { $regex: new RegExp(`^${status}$`, "i") };
    }

    // ✅ Parse search as date if valid
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
        $lte: new Date(`${todate}T23:59:59.999Z`),
      };
    } else if (date) {
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      const nextDate = new Date(parsedDate.getTime() + 86400000); // +1 day
      matchFilter.date = {
        $gte: parsedDate,
        $lt: nextDate,
      };
    } else if (searchDate) {
      matchFilter.date = {
        $gte: searchDate,
        $lt: new Date(searchDate.getTime() + 86400000),
      };
    }

    // ✅ Add fuzzy status search only if `status` filter not already set
    if (!status && search) {
      matchFilter.status = { $regex: new RegExp(search, "i") };
    }

    // 🔁 If specific staff attendance with ID
    if (staffId) {
      const result = await InstructorAttendance.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "instructors",
            localField: "instructor",
            foreignField: "_id",
            as: "instructor",
          },
        },
        { $unwind: "$instructor" },
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

      const instructorInfo = await Instructors.findById(staffId).lean();

      return res.status(200).json({
        success: true,
        currentPage: page,
        totalPages,
        totalCount,
        dataCount: paginatedRecords.length,
        instructors: instructorInfo,
        records: paginatedRecords,
      });
    }

    // 🔄 General list for all instructors
    let baseMatch = matchFilter;

    if (search) {
      baseMatch = {
        ...matchFilter,
        $or: [
          { "instructor.fullName": { $regex: search, $options: "i" } },
          { "instructor.mobileNumber": { $regex: search, $options: "i" } },
          { "instructor.gender": { $regex: search, $options: "i" } },
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
      {
        $lookup: {
          from: "instructors",
          localField: "instructor",
          foreignField: "_id",
          as: "instructor",
        },
      },
      { $unwind: "$instructor" },
      { $match: baseMatch },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          date: 1,
          checkIn: 1,
          checkOut: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          "instructor._id": 1,
          "instructor.fullName": 1,
          "instructor.mobileNumber": 1,
          "instructor.gender": 1,
          "instructor.email": 1,
          "instructor.address": 1,
          "instructor.photo": 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: "totalCount" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const result = await InstructorAttendance.aggregate(generalPipeline);
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
  } catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Get Instructor Attendance by ID

export const getInstructorAttendanceById = async (req, res) => {
  try {
    const { date } = req.query;
    const instructorId = req.params.id;

    // Validate instructor ID
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({ message: 'Invalid instructor ID' });
    }

    let filter = { instructor: instructorId };

    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0); // Start of the day
      const nextDate = new Date(queryDate);
      nextDate.setDate(queryDate.getDate() + 1); // End of the day

      // Match any date within the range
      filter.date = { $gte: queryDate, $lt: nextDate };
    }

    const attendance = await InstructorAttendance.findOne(filter)
      .populate('instructor', 'fullName email mobileNumber');

    if (!attendance) {
      return res.status(404).json({ message: 'Instructor attendance not found' });
    }

    res.status(200).json(attendance);
  } catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Update Instructor Attendance
export const updateInstructorAttendance = async (req, res) => {
  try {
    const { checkIn, checkOut, status } = req.body;
    

    // ✅ Only include fields that are provided in the request body
    const updateFields = {};
    if (checkIn) updateFields.checkIn = checkIn;
    if (checkOut) updateFields.checkOut = checkOut;
    if (status) updateFields.status = status;

    // ✅ Ensure there's something to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    const attendance = await InstructorAttendance.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!attendance) {
      return res.status(404).json({ message: "Instructor attendance not found" });
    }

    res.status(200).json({ message: "Attendance updated successfully", data: attendance });
  }catch (error) {
    handleValidationError(error, res);
  }
};


// ✅ Delete Instructor Attendance
export const deleteInstructorAttendance = async (req, res) => {
  try {
    const attendance = await InstructorAttendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Instructor attendance not found' });
    }

    res.status(200).json({ message: 'Instructor attendance deleted successfully' });
  } catch (error) {
    handleValidationError(error, res);
  }
};
