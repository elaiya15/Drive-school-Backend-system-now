
import express from "express";
import adminController from "../controllers/adminController.js";
import userController from "../controllers/userController.js";
import jwtAuth from "../middlewares/jwtMiddleware.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const fileFields = [
  { name: "photo", maxCount: 1 }, // 🚨 "photo" leaner of "profile"
  { name: "signature", maxCount: 1 },
  { name: "aadharCard", maxCount: 1 },
  { name: "educationCertificate", maxCount: 1 },
  { name: "passport", maxCount: 1 },
  { name: "notary", maxCount: 1 },
]; 

const fileFieldsInstead = [
  { name: "photo", maxCount: 1 }, // 🚨 "photo" instead of "profile"
];
// get all data
router.get("/instructors", jwtAuth(["Admin","Instructor"]), userController.getAllInstructors);
router.get("/learners",jwtAuth(["Admin", "Learner","Instructor"]), userController.getAllLearners);

// get single data
router.get("/instructor/:_id",jwtAuth(["Admin","Instructor"]), userController.getInstructorById);
router.get("/learner/:_id", userController.getLearnersById);

// UPDATE
router.put("/instructor/:instructorId",jwtAuth(["Admin","Instructor"]),upload.fields(fileFieldsInstead),userController.updateInstructor);
router.put("/learner/:admissionNumber",jwtAuth(["Admin","Instructor"]),upload.fields(fileFields), userController.updateLearner);

// DELETE
router.delete("/instructor/:_id",jwtAuth(["Admin"]), userController.deleteInstructor);
router.delete("/learner/:_id",jwtAuth(["Admin"]), userController.deleteLearner);

export default router;
