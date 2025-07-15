
import mongoose from "mongoose";
import Test from "../models/Test.models.js";
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


// Create a new test
export const createTest = async (req, res) => {
  try {
    const { learnerId, testType, date, result } = req.body;
    const newTest = new Test({ learnerId, testType, date, result });
    await newTest.save();
    res.status(201).json({ success: true, message: "Test created successfully", test: newTest });
  } catch (error) {
    handleValidationError(error, res);
  }
};


// ✅ Get all tests using MongoDB Aggregation

export const getAllTests = async (req, res) => {
  try {
    const {  testType, result, gender } = req.query;
    const id = req.params.id;
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const search = req.query.search ? req.query.search.trim() : "";

    // ✅ If page & limit are missing, fetch all data
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;
    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;
    const date =req.query.date ||null;

    let matchFilter = {};

    // ✅ Normalize filters
    const normalizeFilter = (value) => {
      if (!value) return null;
      const normalized = value.replace(/\s+/g, ""); // Remove spaces
      return { $regex: `^${normalized.replace(/(.{1})/g, "$1\\s*")}$`, $options: "i" }; // Allow flexible spacing
    };
    
    if (id) matchFilter["learner._id"] = new mongoose.Types.ObjectId(id);
    if (testType) matchFilter.testType = normalizeFilter(testType);
    if (result) matchFilter.result = normalizeFilter(result);
    if (gender) matchFilter["learner.gender"] = normalizeFilter(gender);
    
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
      matchFilter.$or = [
        { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
        { "learner.fathersName": { $regex: trimmedSearch, $options: "i" } },
        { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
        { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
        { testType: { $regex: trimmedSearch, $options: "i" } },
        { result: { $regex: trimmedSearch, $options: "i" } },
      ];
    }
  }
    // ✅ Always Apply Date Range Filtering
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

  
    // ✅ If search is a valid ObjectId, filter by `learner._id`
    if (mongoose.Types.ObjectId.isValid(search)) {
      matchFilter.$or.push({ "learner._id": new mongoose.Types.ObjectId(search) });
    }

    // ✅ Get total count of filtered records (before pagination)
    const totalTestsResult = await Test.aggregate([
      {
        $lookup: {
          from: "learners",
          localField: "learnerId",
          foreignField: "_id",
          as: "learner",
        },
      },
      { $unwind: "$learner" },
      { $match: matchFilter },
      { $count: "total" },
    ]);

    const totalTests = totalTestsResult.length > 0 ? totalTestsResult[0].total : 0;
    const totalPages = paginate ? Math.ceil(totalTests / limit) : 1;

    const pipeline = [
      {
        $lookup: {
          from: "learners",
          localField: "learnerId",
          foreignField: "_id",
          as: "learner",
        },
      },
      {
        $unwind: { 
          path: "$learner", 
          preserveNullAndEmptyArrays: true // ✅ Keep documents even if no matching learner
        }
      },
      { $match: matchFilter }, // ✅ Apply filters after lookup and unwind
      { $sort: { createdAt: -1 } }, // ✅ Sort by latest createdAt
     
    ];
    
    // ✅ Conditionally exclude `learner` if `id` is provided
    if (id) {
      pipeline.push({ $project: { learner: 0 } });
    }


    // ✅ Apply pagination if applicable
    if (paginate) {
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: limit });
    }

    const tests = await Test.aggregate(pipeline);

    res.status(200).json({
      success: true,
      totalPages,
      currentPage: paginate ? page : 1,
      totalTests, // ✅ Total number of filtered records
      testsCount: tests.length,
      tests, // ✅ Current page's test records
    });
  }catch (error) {
    handleValidationError(error, res);
  }
};



// Get a single test by ID
export const getTestById = async (req, res) => {
  try {


    const test = await Test.findById(req.params.id).populate("learnerId");
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    res.status(200).json({ success: true, test });
  }catch (error) {
    handleValidationError(error, res);
  }
};

// Update a test by ID
export const updateTest = async (req, res) => {
  try {
    const { learnerId, testType, date, result } = req.body;
    const updatedTest = await Test.findByIdAndUpdate(req.params.id, { learnerId, testType, date, result }, { new: true });

    if (!updatedTest) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    res.status(200).json({ success: true, message: "Test updated successfully", test: updatedTest });
  } catch (error) {
    handleValidationError(error, res);
  }
};

// Delete a test by ID
export const deleteTest = async (req, res) => {
  try {
    const deletedTest = await Test.findByIdAndDelete(req.params.id);
    if (!deletedTest) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    res.status(200).json({ success: true, message: "Test deleted successfully" });
  }catch (error) {
    handleValidationError(error, res);
  }
};
