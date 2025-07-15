import Payment from "../models/payment.model.js";
import mongoose from "mongoose";
import Learner from "../models/LearnerSchema.models.js";

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


// Create Payment
export const createPayment = async (req, res) => {
  try {
    const { learnerId, paymentMethod, amount,date } = req.body;

    const newPayment = new Payment({ learnerId, paymentMethod, amount,date ,createdBy: req.user.user_id });
    await newPayment.save();

    res.status(201).json({ message: "Payment recorded successfully", newPayment });
  } catch (error) {
    handleValidationError(error, res);
  }
};

// Get All Payments

export const getPayments = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";
    const id = req.params.id || null;
    const date =req.query.date ||null;
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
    const skip = (page - 1) * limit;

    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const paymentMethod = req.query.paymentMethod || null;

    let matchFilter = {};

    if (id) {
      matchFilter["learner._id"] = new mongoose.Types.ObjectId(id);
    }

    if (req.params.createdBy) {
      matchFilter.createdBy = new mongoose.Types.ObjectId(req.params.createdBy);
    }



    
    // ✅ Handle search logic
    const datePattern = /^\d{2}-\d{2}-\d{4}$/;
    let parsedSearchDate = null;

    if (datePattern.test(search)) {
      const [day, month, year] = search.split("-");
      parsedSearchDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
      // console.log(parsedSearchDate);
      
    } else if (!isNaN(Date.parse(search))) {
      parsedSearchDate = new Date(search); // fallback for ISO format
    }

    if (search) {
      const trimmedSearch = search
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1.*$2")
        .replace(/\s+/g, ".*");

   
    if (parsedSearchDate) {
      // 🔒 Strict date-only search
      matchFilter.date = {
        $gte: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate(), 0, 0, 0),
        $lt: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate() + 1, 0, 0, 0)
      };
    } else {
      // 🔍 Fuzzy match on text/numbers
      matchFilter.$or = [
        { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
        { "learner.fathersName": { $regex: trimmedSearch, $options: "i" } },
        { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
        { paymentMethod: { $regex: search, $options: "i" } },
        ...(parseFloat(search) ? [{ amount: parseFloat(search) }] : [])
      ];
    }
  }


    // ✅ Filter by payment method
    if (paymentMethod) {
      matchFilter.paymentMethod = paymentMethod;
    }

    // ✅ Filter by date range
   
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
    

    // ✅ Fields to include if learner ID is not specified
    const learnerFields = id
      ? {}
      : {
          "learner._id": 1,
          "learner.fullName": 1,
          "learner.fathersName": 1,
          "learner.mobileNumber": 1,
          "learner.dateOfBirth": 1,
          "learner.gender": 1,
          "learner.bloodGroup": 1,
          "learner.address": 1,
          "learner.photo": 1,
          "learner.licenseNumber": 1,
          "learner.llrNumber": 1,
          "learner.admissionNumber": 1
        };

    const pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "learners",
          localField: "learnerId",
          foreignField: "_id",
          as: "learner"
        }
      },
      { $unwind: "$learner" },
      { $match: matchFilter },
      {
        $lookup: {
          from: "instructors",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByDetails"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "createdByDetails._id",
          foreignField: "refId",
          as: "created"
        }
      },
      {
        $project: {
          _id: 1,
          paymentMethod: 1,
          amount: 1,
          date: 1,
          ...learnerFields,
          createdBy: {
            role: { $arrayElemAt: ["$created.role", 0] },
            username: { $arrayElemAt: ["$created.username", 0] },
            refDetails: {
              _id: { $arrayElemAt: ["$createdByDetails._id", 0] },
              fullName: { $arrayElemAt: ["$createdByDetails.fullName", 0] },
              mobileNumber: { $arrayElemAt: ["$createdByDetails.mobileNumber", 0] },
              photo: { $arrayElemAt: ["$createdByDetails.photo", 0] }
            }
          }
        }
      }
    ];

    if (paginate) {
      pipeline.push({
        $facet: {
          metadata: [{ $count: "totalPayments" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      });

      const result = await Payment.aggregate(pipeline);
      const payments = result[0].data || [];
      const totalPayments = result[0].metadata[0] ? result[0].metadata[0].totalPayments : 0;
      const totalPages = Math.ceil(totalPayments / limit);

      return res.status(200).json({
        success: true,
        totalPages,
        currentPage: page,
        totalPayments,
        PaymentsCount: payments.length,
        payments
      });
    } else {
      const payments = await Payment.aggregate(pipeline);
      return res.status(200).json({
        success: true,
        totalPayments: payments.length,
        PaymentsCount: payments.length,
        payments
      });
    }
  }catch (error) {
    handleValidationError(error, res);
  }
};


export const getPaymentById = async (req, res) => {
  try {
    const learnerId = req.params.id;

    const search = req.query.search ? req.query.search.trim() : "";
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const paymentMethod = req.query.paymentMethod || null;
    const date = req.query.date || null;

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
    const skip = (page - 1) * limit;


    // Build query filter
    const filter = { learnerId };

    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (fromdate && todate) {
      filter.date = {
        $gte: new Date(fromdate),
        $lte: new Date(todate),
      };
    }
    if (fromdate && todate) { 
      filter.date = {
        $gte: new Date(`${fromdate}T00:00:00.000Z`),
        $lte: new Date(`${todate}T23:59:59.999Z`)
      };
    } else if (req.query.date) {
      const searchDate = new Date(`${date}T00:00:00.000Z`);
      const nextDate = new Date(searchDate.getTime() + 86400000); // +1 day
      filter.date = {
        $gte: searchDate,
        $lt: nextDate,
      };
    }
    // Search filter on paymentMethod or amount

    
    
    // ✅ Handle search logic
    const datePattern = /^\d{2}-\d{2}-\d{4}$/;
    let parsedSearchDate = null;

    if (datePattern.test(search)) {
      const [day, month, year] = search.split("-");
      parsedSearchDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
      // console.log(parsedSearchDate);
      
    } else if (!isNaN(Date.parse(search))) {
      parsedSearchDate = new Date(search); // fallback for ISO format
    }

    if (search) {
      const trimmedSearch = search
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1.*$2")
        .replace(/\s+/g, ".*");

   
    if (parsedSearchDate) {
      // 🔒 Strict date-only search
      filter.date = {
        $gte: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate(), 0, 0, 0),
        $lt: new Date(parsedSearchDate.getFullYear(), parsedSearchDate.getMonth(), parsedSearchDate.getDate() + 1, 0, 0, 0)
      };
    } else {
      filter.$or = [
        { paymentMethod: { $regex: search, $options: "i" } },
        { amount: { $regex: search, $options: "i" } },
      ];
    }
  }
    // Get total count before pagination
    const totalPayments = await Payment.countDocuments(filter);

    // Fetch payments with populated createdBy and learnerId
    let paymentQuery = Payment.find(filter)
      .populate({
        path: "createdBy",
        populate: {
          path: "refId",
          model: "User", // Adjust if needed based on your User model
          select: "fullName mobileNumber photo",
        },
        select: "username role refId",
      })
      .populate("learnerId");

    if (paginate) {
      paymentQuery = paymentQuery.skip(skip).limit(limit);
    }

    const payments = await paymentQuery.exec();

    if (!payments.length) {
      return res.status(404).json({ message: "No payments found for this learner" });
    }

    const learnerDetails = payments[0].learnerId.toObject();

    const paymentDetails = payments.map((payment) => ({
      _id: payment._id,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      date: payment.date,
      createdBy: {
        role: payment.createdBy?.role || null,
        username: payment.createdBy?.username || null,
        refDetails: payment.createdBy?.refId
          ? {
              _id: payment.createdBy.refId._id,
              fullName: payment.createdBy.refId.fullName,
              mobileNumber: payment.createdBy.refId.mobileNumber,
              photo: payment.createdBy.refId.photo,
            }
          : null,
      },
      __v: payment.__v,
    }));

    const response = [
      {
        learnerId: learnerDetails,
        paymentDetails,
        total: totalPayments,
        page: paginate ? page : undefined,
        limit: paginate ? limit : undefined,
      },
    ];

    res.status(200).json(response);
  }catch (error) {
    handleValidationError(error, res);
  }
};

// Delete Payment
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    res.status(200).json({ message: "Payment deleted successfully" });
  }catch (error) {
    handleValidationError(error, res);
  }
};
