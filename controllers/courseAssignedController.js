import CourseAssigned from '../models/CourseAssigned.models.js';
import moment from "moment"; 
import mongoose from "mongoose";


// 🔧 Reusable Validation & Cast Error Handler
const handleValidationError = (error, res) => {
  const toTitleCase = (str) =>
    str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err) => {
      const field = toTitleCase(err.path || 'Field');

      if (err.name === 'CastError') {
        // Special handling for nested CastError inside ValidationError
        if (err.value === null) {
          return `${field} must not be null`;
        } else if (Array.isArray(err.value)) {
          return `${field} must not be an array`;
        } else {
          return `${field} must be a valid ${err.kind}`;
        }
      } 

      return `${field} is invalid: ${err.message}`;
    });

    return res.status(400).json({ message: 'Validation failed', errors });
  }

  if (error.name === 'CastError') {
    const field = toTitleCase(error.path || 'Field');
    let message;

    if (error.value === null) {
      message = `${field} must not be null`;
    } else if (Array.isArray(error.value)) {
      message = `${field} must not be an array`;
    } else {
      message = `${field} must be a valid ${error.kind}`;
    }

    return res.status(400).json({
      message: 'Validation failed',
      errors: [message],
    });
  }

  console.error('❌ Unhandled Error:', error);
  return res.status(500).json({ message: 'Internal server error' });
};

// ✅ Create Course Assigned (statusTwo is NOT included)

export const createCourseAssigned = async (req, res) => {
  try {
    const { learner, course } = req.body;

    // Find the latest assignment by createdAt descending (newest first)
    const latestAssignmentArr = await CourseAssigned
      .find({ learner, course })
      .sort({ createdAt: -1 })
      .limit(1);

    if (latestAssignmentArr.length > 0) {
      const latestAssignment = latestAssignmentArr[0];
      const { statusOne, statusTwo } = latestAssignment;

      const isCancelled = statusOne === "Cancelled";
      const isExtraClass = statusOne === "Completed" && statusTwo === "Extra class";
      const isReadyToTest = statusOne === "Completed" && statusTwo === "Ready to test";
      const isProcessing = statusOne === "Processing";

      if (isReadyToTest || isProcessing || (!isCancelled && !isExtraClass)) {
        return res.status(400).json({
          message: "Course is already assigned to learner and still active.",
        });
      }
    }

    // Create a new assignment with default statuses
    const courseAssigned = new CourseAssigned({
      learner,
      course,
      statusOne: "Processing",
      statusTwo: null,
    });

    await courseAssigned.save();

    res.status(201).json({
      message: "Course assigned successfully",
      data: courseAssigned,
    });

  }  catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Get All Course Assignments with Search, Filters & Pagination (Including Attendance)
export const getCourseAssigned = async (req, res) => {
  try {
    const {  statusTwo, statusOne, gender } = req.query;
    const search = req.query.search?.trim() || "";
    const id = req.params.id || null;

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const isPaginationEnabled = !isNaN(page) && page > 0 && !isNaN(limit) && limit > 0;

    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const skip = isPaginationEnabled ? (page - 1) * limit : 0;
    
    const searchDate = moment(search, "YYYY-MM-DD", true).isValid()
      ? moment(search, "YYYY-MM-DD").toDate()
      : null;

    let matchFilter = {};

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
      }
     matchFilter["learner._id"] = new mongoose.Types.ObjectId(id);
    }

    if (search) {
      matchFilter.$or = [
        { "learner.fullName": { $regex: search, $options: "i" } },
        { "learner.fathersName": { $regex: search, $options: "i" } },
        { "learner.mobileNumber": { $regex: search, $options: "i" } },
        { "learner.licenseNumber": { $regex: search, $options: "i" } },
        { "learner.llrNumber": { $regex: search, $options: "i" } },
        { "learner.admissionNumber": { $regex: `^\\s*${search}\\s*$`, $options: "i" } },
        { "course.courseName": { $regex: search, $options: "i" } },
        { statusOne: { $regex: search, $options: "i" } },
        { statusTwo: { $regex: search, $options: "i" } },
        ...(searchDate ? [
          { createdAt: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } },
          // { updatedAt: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } }
        ] : [])
      ];
    } else {
      delete matchFilter.$or;
    }

    if (statusOne) matchFilter.statusOne = statusOne;
    if (statusTwo) matchFilter.statusTwo = statusTwo;
    if (gender) matchFilter["learner.gender"] = gender;

    const pipeline = [
      { $sort: { createdAt: -1 } }, 
      {
        $lookup: {
          from: "learners",
          localField: "learner",
          foreignField: "_id",
          as: "learner"
        }
      },
      { $unwind: "$learner" },

      {
        $lookup: {
          from: "courses",
          localField: "course",
          foreignField: "_id",
          as: "course"
        }
      },
      { $unwind: "$course" },

      {
        $lookup: {
          from: "learnerattendances",
          let: { learnerId: "$learner._id", courseId: "$course._id" },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ["$learner", "$$learnerId"] },
                    { $eq: ["$courseType", "$$courseId"] }
                  ] 
                }
              } 
            },
            { $count: "attendedDays" }
          ],
          as: "attendance"
        }
      },

      {
        $addFields: {
          attendedDays: { $ifNull: [{ $arrayElemAt: ["$attendance.attendedDays", 0] }, 0] },
          totalDays: "$course.duration"
        }
      },

      { 
        $addFields: {
          attendanceRatio: {
            $cond: {
              if: { $gt: ["$totalDays", 0] },
              then: { $concat: [{ $toString: "$attendedDays" }, "/", { $toString: "$totalDays" }] },
              else: "0/0"
            }
          }
        }
      },

      { $match: matchFilter },

      {
        $project: {
          learner: id ? "$$REMOVE" : { _id: 1, fullName: 1, fathersName: 1, photo: 1, mobileNumber: 1, gender: 1, admissionNumber: 1, licenseNumber: 1, llrNumber: 1 },
          course: { _id: 1, courseName: 1, duration: 1 },
          statusOne: 1,
          statusTwo: 1,
          createdAt: 1,
          updatedAt: 1,
          attendedDays: 1,
          totalDays: 1,
          attendanceRatio: 1
        }
      }
    ];

    if (isPaginationEnabled) {
      pipeline.push({
        $facet: {
          metadata: [{ $count: "totalAssignments" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      });
    }

    const result = await CourseAssigned.aggregate(pipeline);
    const totalAssignments = result[0]?.metadata?.[0]?.totalAssignments || 0;
    const assignments = isPaginationEnabled ? result[0].data : result;
    const totalPages = isPaginationEnabled ? Math.ceil(totalAssignments / limit) : 1;
    const assignmentsCount = assignments.length

    res.status(200).json({ success: true, totalPages, currentPage: isPaginationEnabled ? page : 1, totalAssignments, assignmentsCount,assignments });
  }  catch (error) {
    handleValidationError(error, res);
  }
};


// ✅ Get Course Assignment by ID
export const getCourseAssignedById = async (req, res) => {
  try {
    const courseAssigned = await CourseAssigned.findById(req.params._id)
      .populate('learner')
      .populate('course');

    if (!courseAssigned) return res.status(404).json({ message: 'Course Assignment not found' });

    res.status(200).json(courseAssigned);
  }  catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Update Course Assignment (Allows statusTwo)
export const updateCourseAssigned = async (req, res) => {
  try {
    const { statusOne, statusTwo,learner } = req.body;
    const courseAssigned = await CourseAssigned.findById(req.params._id);

    if (!courseAssigned) return res.status(404).json({ message: 'Course Assignment not found' });
  
   if (learner) {courseAssigned.learner=learner;}

    if (statusOne) {
      courseAssigned.statusOne = statusOne;

      if (statusOne === "Completed") {
        courseAssigned.statusTwo = "Ready to test";
      } else if (statusOne === "Cancelled" || statusOne === "Processing") {
        courseAssigned.statusTwo = null;
      }
    }
    if (statusTwo  && !statusOne) {
      courseAssigned.statusOne = "Completed";
      courseAssigned.statusTwo = statusTwo; }// Only update statusTwo here


    await courseAssigned.save();
    res.status(200).json({ message: 'Course assignment updated successfully', data: courseAssigned });

  } catch (error) {
    handleValidationError(error, res);
  }
};

// ✅ Delete Course Assignment
export const deleteCourseAssigned = async (req, res) => {
  try {
    const courseAssigned = await CourseAssigned.findByIdAndDelete(req.params._id);
    if (!courseAssigned) return res.status(404).json({ message: 'Course Assignment not found' });

    res.status(200).json({ message: 'Course Assignment deleted successfully' });
  }  catch (error) {
    handleValidationError(error, res);
  }
};
