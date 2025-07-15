// controllers/learnerAttendanceController.js
import LearnerAttendance from '../models/Learner_Attendance.models.js';
import CourseAssigned from '../models/CourseAssigned.models.js';
import Instructors from '../models/InstructorSchema.models.js';
import Learner from '../models/LearnerSchema.models.js';
import mongoose from "mongoose";

// Create Attendance 

export const createAttendance = async (req, res) => {
  try {

      let attendanceData = { ...req.body, createdBy: req.user.user_id };
     
    //   console.log(attendanceData);
    // return
      
      let updateStatus = req.body.readytotest || req.body.Extraclass;

      if (updateStatus) {
          const { courseId, statusOne, statusTwo, _id } = updateStatus;
          const courseAssigned = await CourseAssigned.findById(_id);

          if (!courseAssigned) {
              return res.status(404).json({ message: "Course Assignment not found" });
          }

          // Since `course` is a single ObjectId, direct comparison is needed
          if (courseAssigned.course.toString() !== courseId) {
              return res.status(404).json({ message: "Course ID does not match assigned course" });
          }

          // Update status fields
          if (statusOne) courseAssigned.statusOne = statusOne;
          if (statusTwo) courseAssigned.statusTwo = statusTwo;

          await courseAssigned.save();
      }

      // Create and save attendance record
      const attendance = new LearnerAttendance(attendanceData);
      await attendance.save();
      return res.status(201).json(attendance);

  } catch (error) {
      console.error("Error:", error);
      return res.status(400).json({ error: error.message });
  }
};



// Get All Attendances with Date Filtering & Pagination
export const getAllAttendances = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const date =req.query.date ||null;
    const classType =req.query.classType ||null;
  // console.log(req.params.id);

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;

    const matchFilter = {};

    if (req.params.id) {
      matchFilter["learner"] = new mongoose.Types.ObjectId(req.params.id);
    }
    if (fromdate && todate) { 
      matchFilter.date = {
        $gte: new Date(`${fromdate}T00:00:00.000Z`),
        $lte: new Date(`${todate}T23:59:59.999Z`)
      };
    } else if (date) {
      const searchDate = new Date(`${date}T00:00:00.000Z`);
      const nextDate = new Date(searchDate.getTime() + 86400000); // +1 day
      matchFilter.date = {
        $gte: searchDate,
        $lt: nextDate,
      };
    }

    if (req.params.createdBy) {
      matchFilter.createdBy = new mongoose.Types.ObjectId(req.params.createdBy);
    }
    
    if (req.query.classType) {
      matchFilter.classType = { $regex: req.query.classType, $options: "i" };
    }

    // Try parsing search as date
    const isValidDate = (str) => {
      const parts = str.split("-");
      if (parts.length !== 3) return null;
      const [dd, mm, yyyy] = parts.map(Number);
      const date = new Date(yyyy, mm - 1, dd);
      return isNaN(date.getTime()) ? null : date;
    };

    const parsedSearchDate = isValidDate(search);

    if (parsedSearchDate) {
      matchFilter.date = {
        $gte: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate(), 0, 0, 0),
        $lt: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate() + 1, 0, 0, 0),
      };
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "learners",
          localField: "learner",
          foreignField: "_id",
          as: "learner",
        },
      },
      { $unwind: "$learner" },
      {
        $lookup: {
          from: "courses",
          localField: "courseType",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "refId",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "instructors",
          localField: "createdByDetails.refId",
          foreignField: "_id",
          as: "createdByDetails.refDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails.refDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (!parsedSearchDate && search) {
      pipeline.push({
        $match: {
          $or: [
            { "learner.fullName": { $regex: search, $options: "i" } },
            { "learner.mobileNumber": { $regex: search, $options: "i" } },
            { "learner.licenseNumber": { $regex: search, $options: "i" } },
            { "learner.llrNumber": { $regex: search, $options: "i" } },
            { "learner.admissionNumber": { $regex: search, $options: "i" } },
            { "course.courseName": { $regex: search, $options: "i" } },
            
          ],
        },
      });
    }

    pipeline.push(
      { $group: { _id: "$_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "learnerattendances",
          let: { learnerId: "$learner._id", courseId: "$courseType" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$learner", "$$learnerId"] },
                    { $eq: ["$courseType", "$$courseId"] },
                  ],
                },
              },
            },
            { $count: "attendedDays" },
          ],
          as: "attendanceCount",
        },
      },
      {
        $addFields: {
          attendedDays: {
            $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          learner: {
            _id: "$learner._id",
            fullName: "$learner.fullName",
            mobileNumber: "$learner.mobileNumber",
            dateOfBirth: "$learner.dateOfBirth",
            gender: "$learner.gender",
            bloodGroup: "$learner.bloodGroup",
            address: "$learner.address",
            photo: "$learner.photo",
            licenseNumber: "$learner.licenseNumber",
            llrNumber: "$learner.llrNumber",
            admissionNumber: "$learner.admissionNumber",
          },
          courseType: 1,
          classType: 1,
          date: 1,
          checkIn: 1,
          checkOut: 1,
          createdAt: 1,
          updatedAt: 1,
          descriptions: 1,
          createdBy: {
            role: "$createdByDetails.role",
            username: "$createdByDetails.username",
            refDetails: {
              _id: "$createdByDetails.refDetails._id",
              fullName: "$createdByDetails.refDetails.fullName",
              mobileNumber: "$createdByDetails.refDetails.mobileNumber",
              photo: "$createdByDetails.refDetails.photo",
            },
          },
          course: {
            _id: "$course._id",
            courseName: "$course.courseName",
            duration: "$course.duration",
          },
          attendedDays: 1,
          totalDays: "$course.duration",
          attendancePercentage: {
            $concat: [
              {
                $toString: {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$attendedDays", { $ifNull: ["$course.duration", 1] }] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
              },
              "%",
            ],
          },
          attendanceRatio: {
            $concat: [
              { $toString: "$attendedDays" },
              "/",
              { $toString: { $ifNull: ["$course.duration", 1] } },
            ],
          },
        },
      }
    );

    const finalPipeline = paginate
      ? [
          {
            $facet: {
              data: [...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }],
              total: [...pipeline, { $count: "count" }],
            },
          },
          {
            $addFields: {
              totalCount: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
            },
          },
        ]
      : pipeline;

    const result = await LearnerAttendance.aggregate(finalPipeline);

    if (paginate) {
      const { data, totalCount } = result[0];
      res.status(200).json({
        totalRecords: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        currentdata: data.length,
        data,
      });
    } else {
      res.status(200).json({
        totalRecords: result.length,
        currentPage: "All",
        totalPages: "N/A",
        currentdata: result.length,
        data: result,
      });
    }
  } catch (error) {
    console.error("Error fetching attendances:", error);
    res.status(500).json({ error: error.message });
  }
};

// export const getAllAttendances = async (req, res) => {
//   try {
//       const search = req.query.search ? req.query.search.trim() : "";
//       let page = parseInt(req.query.page, 10);
//       let limit = parseInt(req.query.limit, 10);
      
//       // ✅ If page & limit are missing, fetch all data
//       const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
      
//       const fromdate = req.query.fromdate || null;
//       const todate = req.query.todate || null;
    
  
     
//       let matchFilter = {}; 

//      // ✅ Assign queryDate but do not filter by default date

//     //   if (req.query.date !== undefined) {
//     //     // ✅ If date is provided, use it, else use today's date
//     //     let queryDate = req.query.date ? new Date(req.query.date) : new Date(); 
//     //     queryDate.setHours(0, 0, 0, 0); // Reset time to midnight
        
//     //     let nextDay = new Date(queryDate);
//     //     nextDay.setDate(nextDay.getDate() + 1); // Add one day to queryDate
        
//     //     matchFilter.date = { $gte: queryDate, $lt: nextDay };
//     // }
    
      

//          // ✅ Always Apply Date Range Filtering
//          if (fromdate || todate) {
//           matchFilter.date = {
//               ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
//               ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
//           };
//       }

//       let searchDate = !isNaN(Date.parse(search)) ? new Date(search) : null;
//       const trimmedSearch = search.replace(/([a-z])([A-Z])/g, "$1.*$2").replace(/\s+/g, ".*");

//       // ✅ If ID is provided, filter by learner._id
//       if (req.query.id) {
//           matchFilter["learner._id"] = new mongoose.Types.ObjectId(req.query.id);
//       }

//       if (search) {
//           matchFilter.$or = [
//               { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
//               { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
//               { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
//               { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
//               { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
//               { "course.courseName": { $regex: search, $options: "i" } },
//               ...(searchDate ? [{ date: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } }] : [])
//           ];
//       }

//       const pipeline = [
//         { $match: matchFilter },
//           { $sort: { createdAt: -1 } }, 
//           {
//               $lookup: {
//                   from: "learners",
//                   localField: "learner",
//                   foreignField: "_id",
//                   as: "learner"
//               }
//           },
//           { $unwind: "$learner" },
//           {
//               $lookup: {
//                   from: "courses",
//                   localField: "courseType",
//                   foreignField: "_id",
//                   as: "course"
//               }
//           },
//           { $unwind: "$course" },
         
//                        // Step 1: Lookup user by matching createdBy to users.refId
//            {
//              $lookup: {
//                from: "users",
//                localField: "createdBy",
//                foreignField: "refId",
//                as: "createdByDetails"
//              }
//            },
//            {
//              $unwind: {
//                path: "$createdByDetails",
//                preserveNullAndEmptyArrays: true
//              }
//            },
         
//            // Step 2: Lookup instructor using user.refId
//            {
//              $lookup: {
//                from: "instructors",
//                localField: "createdByDetails.refId",
//                foreignField: "_id",
//                as: "createdByDetails.refDetails"
//              }
//            },
//            {
//              $unwind: {
//                path: "$createdByDetails.refDetails",
//                preserveNullAndEmptyArrays: true
//              }
//            }


//           {
//               $lookup: {
//                   from: "learnerattendances",
//                   let: { learnerId: "$learner._id", courseId: "$courseType" },
//                   pipeline: [
//                       {
//                           $match: {
//                               $expr: {
//                                   $and: [
//                                       { $eq: ["$learner", "$$learnerId"] },
//                                       { $eq: ["$courseType", "$$courseId"] }
//                                   ]
//                               }
//                           }
//                       },
//                       { $count: "attendedDays" }
//                   ],
//                   as: "attendanceCount"
//               }
//           },
//           {
//               $addFields: {
//                   attendedDays: { $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0] }
//               }
//           },
//           {
//               $project: {
//                   _id: 1,
//                   learner: {
//                       _id: "$learner._id",
//                       fullName: "$learner.fullName",
//                       mobileNumber: "$learner.mobileNumber",
//                       dateOfBirth: "$learner.dateOfBirth",
//                       gender: "$learner.gender",
//                       bloodGroup: "$learner.bloodGroup",
//                       address: "$learner.address",
//                       photo: "$learner.photo",
//                       licenseNumber: "$learner.licenseNumber",
//                       llrNumber: "$learner.llrNumber",
//                       admissionNumber: "$learner.admissionNumber",
//                   },
//                   courseType: 1,
//                   classType: 1,
//                   date: 1,
//                   checkIn: 1,
//                   checkOut: 1,
//                   createdAt: 1,
//                   updatedAt: 1,
//                   createdBy: {
//                     role: "$createdByDetails.role",
//                     username: "$createdByDetails.username",
//                     refId: "$createdByDetails.refId",
//                     refDetails: {
//                       _id: "$createdByDetails.refDetails._id",
//                       fullName: "$createdByDetails.refDetails.fullName",
//                       mobileNumber: "$createdByDetails.refDetails.mobileNumber",
//                     },
//                   },
//                   course: {
//                       _id: "$course._id",
//                       courseName: "$course.courseName",
//                       duration: "$course.duration",
//                   },
//                   attendedDays: 1,
//                   totalDays: "$course.duration",
//                   attendancePercentage: {
//                       $concat: [
//                           {
//                               $toString: {
//                                   $round: [
//                                       { $multiply: [{ $divide: ["$attendedDays", { $ifNull: ["$course.duration", 1] }] }, 100] },
//                                       2
//                                   ]
//                               }
//                           },
//                           "%"
//                       ]
//                   },
//                   attendanceRatio: {
//                       $concat: [{ $toString: "$attendedDays" }, "/", { $toString: { $ifNull: ["$course.duration", 1] } }]
//                   }
//               }
//           },
         
//       ];

//       // ✅ Apply pagination only if page & limit are valid
//       if (paginate) {
//           pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
//       }

//       const attendances = await LearnerAttendance.aggregate(pipeline);
//       const totalRecords = await LearnerAttendance.countDocuments(matchFilter);

//       res.status(200).json({
//           totalRecords,
//           currentPage: page || "All",
//           totalPages: paginate ? Math.ceil(totalRecords / limit) : "N/A",
//           data: attendances
//       });
//   } catch (error) {
//       console.error("Error fetching attendances:", error);
//       res.status(500).json({ error: error.message });
//   }
// };

// export const getAllAttendances = async (req, res) => {
//     try {
//       const search = req.query.search ? req.query.search.trim() : "";
//       let page = parseInt(req.query.page, 10);
//       let limit = parseInt(req.query.limit, 10);
//       const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
  
//       const fromdate = req.query.fromdate || null;
//       const todate = req.query.todate || null;
  
//       let matchFilter = {};
  
//       if (fromdate || todate) {
//         matchFilter.date = {
//           ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
//           ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
//         };
//       }
  
//       let searchDate = !isNaN(Date.parse(search)) ? new Date(search) : null;
//       const trimmedSearch = search.replace(/([a-z])([A-Z])/g, "$1.*$2").replace(/\s+/g, ".*");
  
//       if (req.query.id) {
//         matchFilter["learner._id"] = new mongoose.Types.ObjectId(req.query.id);
//       }
  
//       if (search) {
//         matchFilter.$or = [
//           { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
//           { "course.courseName": { $regex: search, $options: "i" } },
//           ...(searchDate ? [{ date: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } }] : [])
//         ];
//       }
  
//       const pipeline = [
//         { $match: matchFilter },
//         { $sort: { createdAt: -1 } },
//         {
//           $lookup: {
//             from: "learners",
//             localField: "learner",
//             foreignField: "_id",
//             as: "learner"
//           }
//         },
//         { $unwind: "$learner" },
//         {
//           $lookup: {
//             from: "courses",
//             localField: "courseType",
//             foreignField: "_id",
//             as: "course"
//           }
//         },
//         { $unwind: "$course" },
       
//          // Lookup createdBy user
//          {
//              $lookup: {
//                from: "users",
//                localField: "createdBy",
//                foreignField: "refId",
//                as: "createdByDetails"
//              }
//            },
//            {
//              $unwind: {
//                path: "$createdByDetails",
//                preserveNullAndEmptyArrays: true
//              }
//            },
//            // Lookup instructor info using user's refId
//            {
//              $lookup: {
//                from: "instructors",
//                localField: "createdByDetails.refId",
//                foreignField: "_id",
//                as: "createdByDetails.refDetails"
//              }
//            },
//            {
//              $unwind: {
//                path: "$createdByDetails.refDetails",
//                preserveNullAndEmptyArrays: true
//              }
//            },
           
         
         
//                  {
//                    $lookup: {
//             from: "learnerattendances",
//             let: { learnerId: "$learner._id", courseId: "$courseType" },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [
//                       { $eq: ["$learner", "$$learnerId"] },
//                       { $eq: ["$courseType", "$$courseId"] }
//                     ]
//                   }
//                 }
//               },
//               { $count: "attendedDays" }
//             ],
//             as: "attendanceCount"
//           }
//         },
//         {
//           $addFields: {
//             attendedDays: { $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0] }
//           }
//         },
//         {
//           $project: {
//             _id: 1,
//             learner: {
//               _id: "$learner._id",
//               fullName: "$learner.fullName",
//               mobileNumber: "$learner.mobileNumber",
//               dateOfBirth: "$learner.dateOfBirth",
//               gender: "$learner.gender",
//               bloodGroup: "$learner.bloodGroup",
//               address: "$learner.address",
//               photo: "$learner.photo",
//               licenseNumber: "$learner.licenseNumber",
//               llrNumber: "$learner.llrNumber",
//               admissionNumber: "$learner.admissionNumber",
//             },
//             courseType: 1,
//             classType: 1,
//             date: 1,
//             checkIn: 1,
//             checkOut: 1,
//             createdAt: 1,
//             updatedAt: 1,
        
//             createdBy: {
//                 role: "$createdByDetails.role",
//                 username: "$createdByDetails.username",
//                 refId: "$createdByDetails.refId",
//                 refDetails: {
//                   _id: "$createdByDetails.refDetails._id",
//                   fullName: "$createdByDetails.refDetails.fullName",
//                   mobileNumber: "$createdByDetails.refDetails.mobileNumber",
//                 },
//               }
              

//             course: {
//               _id: "$course._id",
//               courseName: "$course.courseName",
//               duration: "$course.duration",
//             },
//             attendedDays: 1,
//             totalDays: "$course.duration",
//             attendancePercentage: {
//               $concat: [
//                 {
//                   $toString: {
//                     $round: [
//                       {
//                         $multiply: [
//                           { $divide: ["$attendedDays", { $ifNull: ["$course.duration", 1] }] },
//                           100
//                         ]
//                       },
//                       2
//                     ]
//                   }
//                 },
//                 "%"
//               ]
//             },
//             attendanceRatio: {
//               $concat: [
//                 { $toString: "$attendedDays" },
//                 "/",
//                 { $toString: { $ifNull: ["$course.duration", 1] } }
//               ]
//             }
//           }
//         }
//       ];
  
//       if (paginate) {
//         pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
//       }
  
//       const attendances = await LearnerAttendance.aggregate(pipeline);
//       const totalRecords = await LearnerAttendance.countDocuments(matchFilter);
  
//       res.status(200).json({
//         totalRecords,
//         currentPage: page || "All",
//         totalPages: paginate ? Math.ceil(totalRecords / limit) : "N/A",
//         data: attendances
//       });
//     } catch (error) {
//       console.error("Error fetching attendances:", error);
//       res.status(500).json({ error: error.message });
//     }
// };
  
// export const getAllAttendances = async (req, res) => {
//     try {
//       const search = req.query.search ? req.query.search.trim() : "";
//       let page = parseInt(req.query.page, 10);
//       let limit = parseInt(req.query.limit, 10);
//       const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
  
//       const fromdate = req.query.fromdate || null;
//       const todate = req.query.todate || null;
  
//       let matchFilter = {};
  
//       if (fromdate || todate) {
//         matchFilter.date = {
//           ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
//           ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
//         };
//       }
  
//       let searchDate = !isNaN(Date.parse(search)) ? new Date(search) : null;
//       const trimmedSearch = search.replace(/([a-z])([A-Z])/g, "$1.*$2").replace(/\s+/g, ".*");
  
//       if (req.query.id) {
//         matchFilter["learner._id"] = new mongoose.Types.ObjectId(req.query.id);
//       }
  
//       if (search) {
//         matchFilter.$or = [
//           { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
//           { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
//           { "course.courseName": { $regex: search, $options: "i" } },
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
//         ];
//       }
  
//       const pipeline = [
//         { $match: matchFilter },
//         { $sort: { createdAt: -1 } },
  
//         {
//           $lookup: {
//             from: "learners",
//             localField: "learner",
//             foreignField: "_id",
//             as: "learner",
//           },
//         },
//         { $unwind: "$learner" },
  
//         {
//           $lookup: {
//             from: "courses",
//             localField: "courseType",
//             foreignField: "_id",
//             as: "course",
//           },
//         },
//         { $unwind: "$course" },
  
//         // Lookup createdBy user
//         {
//           $lookup: {
//             from: "users",
//             localField: "createdBy",
//             foreignField: "refId",
//             as: "createdByDetails",
//           },
//         },
//         {
//           $unwind: {
//             path: "$createdByDetails",
//             preserveNullAndEmptyArrays: true,
//           },
//         },
  
//         // Lookup instructor info using user's refId
//         {
//           $lookup: {
//             from: "instructors",
//             localField: "createdByDetails.refId",
//             foreignField: "_id",
//             as: "createdByDetails.refDetails",
//           },
//         },
//         {
//           $unwind: {
//             path: "$createdByDetails.refDetails",
//             preserveNullAndEmptyArrays: true,
//           },
//         },
  
//         // Get attendance count
//         {
//           $lookup: {
//             from: "learnerattendances",
//             let: { learnerId: "$learner._id", courseId: "$courseType" },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [
//                       { $eq: ["$learner", "$$learnerId"] },
//                       { $eq: ["$courseType", "$$courseId"] },
//                     ],
//                   },
//                 },
//               },
//               { $count: "attendedDays" },
//             ],
//             as: "attendanceCount",
//           },
//         },
  
//         {
//           $addFields: {
//             attendedDays: {
//               $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0],
//             },
//           },
//         },
  
//         {
//           $project: {
//             _id: 1,
//             learner: {
//               _id: "$learner._id",
//               fullName: "$learner.fullName",
//               mobileNumber: "$learner.mobileNumber",
//               dateOfBirth: "$learner.dateOfBirth",
//               gender: "$learner.gender",
//               bloodGroup: "$learner.bloodGroup",
//               address: "$learner.address",
//               photo: "$learner.photo",
//               licenseNumber: "$learner.licenseNumber",
//               llrNumber: "$learner.llrNumber",
//               admissionNumber: "$learner.admissionNumber",
//             },
//             courseType: 1,
//             classType: 1,
//             date: 1,
//             checkIn: 1,
//             checkOut: 1,
//             createdAt: 1,
//             updatedAt: 1,
//             descriptions:1,
//             createdBy: {
//               role: "$createdByDetails.role",
//               username: "$createdByDetails.username",
//               refId: "$createdByDetails.refId",
//               refDetails: {
//                 _id: "$createdByDetails.refDetails._id",
//                 fullName: "$createdByDetails.refDetails.fullName",
//                 mobileNumber: "$createdByDetails.refDetails.mobileNumber",
//                 photo: "$createdByDetails.refDetails.photo",
//               },
//             },
  
//             course: {
//               _id: "$course._id",
//               courseName: "$course.courseName",
//               duration: "$course.duration",
//             },
  
//             attendedDays: 1,
//             totalDays: "$course.duration",
  
//             attendancePercentage: {
//               $concat: [
//                 {
//                   $toString: {
//                     $round: [
//                       {
//                         $multiply: [
//                           {
//                             $divide: [
//                               "$attendedDays",
//                               { $ifNull: ["$course.duration", 1] },
//                             ],
//                           },
//                           100,
//                         ],
//                       },
//                       2,
//                     ],
//                   },
//                 },
//                 "%",
//               ],
//             },
  
//             attendanceRatio: {
//               $concat: [
//                 { $toString: "$attendedDays" },
//                 "/",
//                 { $toString: { $ifNull: ["$course.duration", 1] } },
//               ],
//             },
//           },
//         },
//       ];
  
//       if (paginate) {
//         pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
//       }
  
//       const attendances = await LearnerAttendance.aggregate(pipeline);
//       const totalRecords = await LearnerAttendance.countDocuments(matchFilter);
  
//       res.status(200).json({
//         totalRecords,
//         currentPage: paginate ? page : "All",
//         totalPages: paginate ? Math.ceil(totalRecords / limit) : "N/A",
//         data: attendances,
//       });
//     } catch (error) {
//       console.error("Error fetching attendances:", error);
//       res.status(500).json({ error: error.message });
//     }
// };
export const getAllAttendances = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;

    const matchFilter = {};

    if (req.query.id) {
      matchFilter["learner"] = new mongoose.Types.ObjectId(req.query.id);
    } 
    // if (req.params.id) {
    //   matchFilter["learner._id"]= new mongoose.Types.ObjectId(req.params.id);
    // }

    if (fromdate || todate) {
      matchFilter.date = {
        ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
        ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
      };
    }
    if (req.params.createdBy) {
      matchFilter.createdBy = new mongoose.Types.ObjectId(req.params.createdBy);
    }   
    const pipeline = [
     
      { $match: matchFilter },
      {
        $addFields: {
          date_str: {
            $dateToString: {
              format: "%d-%m-%Y", // Adjust the format as needed
              date: "$date",
            },
          },
        },
      },
      // Lookup Learner
      {
        $lookup: {
          from: "learners",
          localField: "learner",
          foreignField: "_id",
          as: "learner",
        },
      },
      { $unwind: "$learner" },

      // Lookup Course
      {
        $lookup: {
          from: "courses",
          localField: "courseType",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },

      // Lookup User
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "refId",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup Instructor
      {
        $lookup: {
          from: "instructors",
          localField: "createdByDetails.refId",
          foreignField: "_id",
          as: "createdByDetails.refDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails.refDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Search Filter (after learner lookup)
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "learner.fullName": { $regex: search, $options: "i" } },
                  { "learner.mobileNumber": { $regex: search, $options: "i" } },
                  { "learner.licenseNumber": { $regex: search, $options: "i" } },
                  { "learner.llrNumber": { $regex: search, $options: "i" } },
                  { "learner.admissionNumber": { $regex: search, $options: "i" } },
                  { "course.courseName": { $regex: search, $options: "i" } },
                  {date_str:{ $regex: search, $options: "i" } }
                  
                ],
              },
            },
          ]
        : []),

        // ✅ GROUP STAGE TO REMOVE DUPLICATES
  // ✅ GROUP STAGE TO REMOVE DUPLICATES
     {
       $group: {
         _id: "$_id",
         doc: { $first: "$$ROOT" },
       },
     },
     {
       $replaceRoot: { newRoot: "$doc" },
     },
 // ✅ Final consistent sort (LIFO)
 { $sort: { createdAt: -1 } },
      // Attendance Count
      {
        $lookup: {
          from: "learnerattendances",
          let: { learnerId: "$learner._id", courseId: "$courseType" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$learner", "$$learnerId"] },
                    { $eq: ["$courseType", "$$courseId"] },
                  ],
                },
              },
            },
            { $count: "attendedDays" },
          ],
          as: "attendanceCount",
        },
      },
      {
        $addFields: {
          attendedDays: {
            $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0],
          },
        },
      },

      // Final projection
      {
        $project: {
          _id: 1,
          learner: {
            _id: "$learner._id",
            fullName: "$learner.fullName",
            mobileNumber: "$learner.mobileNumber",
            dateOfBirth: "$learner.dateOfBirth",
            gender: "$learner.gender",
            bloodGroup: "$learner.bloodGroup",
            address: "$learner.address",
            photo: "$learner.photo",
            licenseNumber: "$learner.licenseNumber",
            llrNumber: "$learner.llrNumber",
            admissionNumber: "$learner.admissionNumber",
          },
          courseType: 1,
          classType: 1,
          date: 1,
          checkIn: 1,
          checkOut: 1,
          createdAt: 1,
          updatedAt: 1,
          descriptions: 1,
          createdBy: {
            role: "$createdByDetails.role",
            username: "$createdByDetails.username",
          
            refDetails: {
              _id: "$createdByDetails.refDetails._id",
              fullName: "$createdByDetails.refDetails.fullName",
              mobileNumber: "$createdByDetails.refDetails.mobileNumber",
              photo: "$createdByDetails.refDetails.photo",
            },
          },
          course: {
            _id: "$course._id",
            courseName: "$course.courseName",
            duration: "$course.duration",
          },
          attendedDays: 1,
          totalDays: "$course.duration",
          attendancePercentage: {
            $concat: [
              {
                $toString: {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$attendedDays", { $ifNull: ["$course.duration", 1] }] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
              },
              "%",
            ],
          },
          attendanceRatio: {
            $concat: [
              { $toString: "$attendedDays" },
              "/",
              { $toString: { $ifNull: ["$course.duration", 1] } },
            ],
          },
        },
      },
    ];

    const finalPipeline = paginate
      ? [
          {
            $facet: {
              data: [...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }],
              total: [{ $count: "count" }],
            },
          },
          {
            $addFields: {
              totalCount: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
            },
          },
        ]
      : pipeline;

    const result = await LearnerAttendance.aggregate(finalPipeline);

    if (paginate) {
      const { data, totalCount } = result[0];
      res.status(200).json({

        totalRecords: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        data,
      });
    } else {
      res.status(200).json({
        totalRecords: result.length,
        currentPage: "All",
        totalPages: "N/A",
        data: result,
      });
    }
  } catch (error) {
    console.error("Error fetching attendances:", error);
    res.status(500).json({ error: error.message });
  }
};

// export const getAllAttendances = async (req, res) => {
//   try {
//     const search = req.query.search?.trim() || "";
//     const fromdate = req.query.fromdate || null;
//     const todate = req.query.todate || null;
//     const date =req.query.date ||null;

//     let page = parseInt(req.query.page, 10);
//     let limit = parseInt(req.query.limit, 10);
//     const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;

//     const matchFilter = {};

//     if (req.query.id) {
//       matchFilter["learner"] = new mongoose.Types.ObjectId(req.query.id);
//     } 
//     // if (req.params.id) {
//     //   matchFilter["learner._id"]= new mongoose.Types.ObjectId(req.params.id);
//     // }

//     if (fromdate || todate) {
//       matchFilter.date = {
//         ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
//         ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
//       };
//     }

    
//     if (req.params.createdBy) {
//       matchFilter.createdBy = new mongoose.Types.ObjectId(req.params.createdBy);
//     }   
//     const pipeline = [
     
//       { $match: matchFilter },

//       // Lookup Learner
//       {
//         $lookup: {
//           from: "learners",
//           localField: "learner",
//           foreignField: "_id",
//           as: "learner",
//         },
//       },
//       { $unwind: "$learner" },

//       // Lookup Course
//       {
//         $lookup: {
//           from: "courses",
//           localField: "courseType",
//           foreignField: "_id",
//           as: "course",
//         },
//       },
//       { $unwind: "$course" },

//       // Lookup User
//       {
//         $lookup: {
//           from: "users",
//           localField: "createdBy",
//           foreignField: "refId",
//           as: "createdByDetails",
//         },
//       },
//       {
//         $unwind: {
//           path: "$createdByDetails",
//           preserveNullAndEmptyArrays: true,
//         },
//       },

//       // Lookup Instructor
//       {
//         $lookup: {
//           from: "instructors",
//           localField: "createdByDetails.refId",
//           foreignField: "_id",
//           as: "createdByDetails.refDetails",
//         },
//       },
//       {
//         $unwind: {
//           path: "$createdByDetails.refDetails",
//           preserveNullAndEmptyArrays: true,
//         },
//       },

//       // Search Filter (after learner lookup)
//       ...(search
//         ? [
//             {
//               $match: {
//                 $or: [
//                   { "learner.fullName": { $regex: search, $options: "i" } },
//                   { "learner.mobileNumber": { $regex: search, $options: "i" } },
//                   { "learner.licenseNumber": { $regex: search, $options: "i" } },
//                   { "learner.llrNumber": { $regex: search, $options: "i" } },
//                   { "learner.admissionNumber": { $regex: search, $options: "i" } },
//                   { "course.courseName": { $regex: search, $options: "i" } },
//                 ],
//               },
//             },
//           ]
//         : []),

//         // ✅ GROUP STAGE TO REMOVE DUPLICATES
//   // ✅ GROUP STAGE TO REMOVE DUPLICATES
//      {
//        $group: {
//          _id: "$_id",
//          doc: { $first: "$$ROOT" },
//        },
//      },
//      {
//        $replaceRoot: { newRoot: "$doc" },
//      },
//  // ✅ Final consistent sort (LIFO)
//  { $sort: { createdAt: -1 } },
//       // Attendance Count
//       {
//         $lookup: {
//           from: "learnerattendances",
//           let: { learnerId: "$learner._id", courseId: "$courseType" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ["$learner", "$$learnerId"] },
//                     { $eq: ["$courseType", "$$courseId"] },
//                   ],
//                 },
//               },
//             },
//             { $count: "attendedDays" },
//           ],
//           as: "attendanceCount",
//         },
//       },
//       {
//         $addFields: {
//           attendedDays: {
//             $ifNull: [{ $arrayElemAt: ["$attendanceCount.attendedDays", 0] }, 0],
//           },
//         },
//       },

//       // Final projection
//       {
//         $project: {
//           _id: 1,
//           learner: {
//             _id: "$learner._id",
//             fullName: "$learner.fullName",
//             mobileNumber: "$learner.mobileNumber",
//             dateOfBirth: "$learner.dateOfBirth",
//             gender: "$learner.gender",
//             bloodGroup: "$learner.bloodGroup",
//             address: "$learner.address",
//             photo: "$learner.photo",
//             licenseNumber: "$learner.licenseNumber",
//             llrNumber: "$learner.llrNumber",
//             admissionNumber: "$learner.admissionNumber",
//           },
//           courseType: 1,
//           classType: 1,
//           date: 1,
//           checkIn: 1,
//           checkOut: 1,
//           createdAt: 1,
//           updatedAt: 1,
//           descriptions: 1,
//           createdBy: {
//             role: "$createdByDetails.role",
//             username: "$createdByDetails.username",
          
//             refDetails: {
//               _id: "$createdByDetails.refDetails._id",
//               fullName: "$createdByDetails.refDetails.fullName",
//               mobileNumber: "$createdByDetails.refDetails.mobileNumber",
//               photo: "$createdByDetails.refDetails.photo",
//             },
//           },
//           course: {
//             _id: "$course._id",
//             courseName: "$course.courseName",
//             duration: "$course.duration",
//           },
//           attendedDays: 1,
//           totalDays: "$course.duration",
//           attendancePercentage: {
//             $concat: [
//               {
//                 $toString: {
//                   $round: [
//                     {
//                       $multiply: [
//                         { $divide: ["$attendedDays", { $ifNull: ["$course.duration", 1] }] },
//                         100,
//                       ],
//                     },
//                     2,
//                   ],
//                 },
//               },
//               "%",
//             ],
//           },
//           attendanceRatio: {
//             $concat: [
//               { $toString: "$attendedDays" },
//               "/",
//               { $toString: { $ifNull: ["$course.duration", 1] } },
//             ],
//           },
//         },
//       },
//     ];
//     const finalPipeline = paginate
//     ? [
//         {
//           $facet: {
//             data: [...pipeline, { $skip: (page - 1) * limit }, { $limit: limit }],
//             total: [...pipeline, { $count: "count" }],
//           },
//         },
//         {
//           $addFields: {
//             totalCount: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
//           },
//         },
//       ]
//     : pipeline;
  

//     const result = await LearnerAttendance.aggregate(finalPipeline);

//     if (paginate) {
//       const { data, totalCount } = result[0];
//       res.status(200).json({
//         totalRecords: totalCount,
//         currentPage: page,
//         totalPages: Math.ceil(totalCount / limit),
//         currentdata:data.length,
//         data,
//       });
//     } else {
//       res.status(200).json({
//         totalRecords: result.length,
//         currentPage: "All",
//         totalPages: "N/A",
//         currentdata:result.length,
//         data: result,
//       });
//     }
//   } catch (error) {
//     console.error("Error fetching attendances:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
  // Get Attendance by ID

export const getAttendanceById = async (req, res) => {
  try {
    const { fromdate, todate, page = 1, limit = 10 } = req.query;
    const learnerId = req.params.id;

    let filter = { learner: learnerId };

    // Handle date range filtering
    if (fromdate && todate) {
      const fromDateObj = new Date(fromdate);
      fromDateObj.setUTCHours(0, 0, 0, 0);

      const toDateObj = new Date(todate);
      toDateObj.setUTCHours(23, 59, 59, 999); // include whole day

      filter.date = { $gte: fromDateObj, $lte: toDateObj };
    }

    const totalAttendanceRecords = await LearnerAttendance.countDocuments(filter);

    const attendances = await LearnerAttendance.find(filter)
      .populate('learner')
      .populate('courseType')
      .sort({ date: -1 }) // optional: sort by date instead of createdAt
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    if (!attendances.length) {
      return res.status(404).json({ message: 'No attendance records found for this learner' });
    }

    const learnerDetails = attendances[0].learner;

    const attendanceRecords = attendances.map(att => ({
      _id: att._id,
      courseType: att.courseType,
      classType: att.classType,
      date: att.date,
      checkIn: att.checkIn,
      checkOut: att.checkOut,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      descriptions: att.descriptions,
    }));

    const formattedResponse = {
      learner: learnerDetails,
      attendanceRecords,
      currentAttendanceRecords: attendanceRecords.length,
      totalAttendanceRecords,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalAttendanceRecords / parseInt(limit)),
    };

    res.status(200).json(formattedResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// export const getAttendanceById = async (req, res) => {
//     try {
//         const { date } = req.query;
//         const learnerId = req.params.id;

//         // Date filter
//         let matchFilter = { learner: mongoose.Types.ObjectId(learnerId) };

//         if (date) {
//             const queryDate = new Date(date);
//             queryDate.setUTCHours(0, 0, 0, 0);
//             const nextDate = new Date(queryDate);
//             nextDate.setUTCDate(queryDate.getUTCDate() + 1);
//             matchFilter.date = { $gte: queryDate, $lt: nextDate };
//         }

//         const attendances = await LearnerAttendance.aggregate([
//             { $match: matchFilter },

//             // Lookup learner
//             {
//                 $lookup: {
//                     from: 'learners',
//                     localField: 'learner',
//                     foreignField: '_id',
//                     as: 'learner',
//                 },
//             },
//             { $unwind: '$learner' },

//             // Lookup courseType
//             {
//                 $lookup: {
//                     from: 'coursetypes',
//                     localField: 'courseType',
//                     foreignField: '_id',
//                     as: 'courseType',
//                 },
//             },
//             { $unwind: { path: '$courseType', preserveNullAndEmptyArrays: true } },

//             // Lookup createdBy user
//             {
//                 $lookup: {
//                     from: 'users',
//                     localField: 'createdBy',
//                     foreignField: 'refId',
//                     as: 'createdBy',
//                 },
//             },
//             { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },

//             // Lookup instructor or admin from refId
//             {
//                 $lookup: {
//                     from: 'instructors', // or 'admins' depending on your data model
//                     localField: 'createdBy.refId',
//                     foreignField: '_id',
//                     as: 'createdBy.refId',
//                 },
//             },
//             { $unwind: { path: '$createdBy.refId', preserveNullAndEmptyArrays: true } },

//             // Shape the response
//             {
//                 $project: {
//                     _id: 1,
//                     date: 1,
//                     checkIn: 1,
//                     checkOut: 1,
//                     status: 1,
//                     createdAt: 1,
//                     updatedAt: 1,
//                     learner: 1,
//                     courseType: 1,
//                     classType: 1,
//                     createdBy: {
//                         _id: '$createdBy._id',
//                         email: '$createdBy.email',
//                         role: '$createdBy.role',
//                         refId: {
//                             _id: '$createdBy.refId._id',
//                             name: '$createdBy.refId.name',
//                             phone: '$createdBy.refId.phone',
//                         },
//                     },
//                 },
//             },
//         ]);

//         if (!attendances.length) {
//             return res.status(404).json({ message: 'No attendance records found for this learner' });
//         }

//         res.status(200).json(attendances[0]); // assuming you're fetching by date (so 1 record)
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };



// Update Attendance
export const updateAttendance = async (req, res) => {
    try {
        const attendance = await LearnerAttendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!attendance) return res.status(404).json({ message: 'Attendance not found' });
        res.status(200).json(attendance);  
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Attendance
export const deleteAttendance = async (req, res) => {
    try {
        const attendance = await LearnerAttendance.findByIdAndDelete(req.params.id);
        if (!attendance) return res.status(404).json({ message: 'Attendance not found' });
        res.status(200).json({ message: 'Attendance deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
