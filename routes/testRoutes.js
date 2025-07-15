import express from "express";
import {
  createTest,
  getAllTests,
  getTestById,
  updateTest,
  deleteTest
} from "../controllers/testController.js";
import jwtAuth from "../middlewares/jwtMiddleware.js";
const router = express.Router();

router.post("/",jwtAuth(["Admin","Instructor"]), createTest);         // Create test
router.get("/",jwtAuth(["Admin","Instructor","Learner"]), getAllTests);         // Get all tests
router.get("/:id",jwtAuth(["Admin","Instructor","Learner"]), getAllTests);         // Get all tests
router.get("/ById/:id",jwtAuth(["Admin","Instructor","Learner"]), getTestById);      // Get test by ID
router.put("/:id", jwtAuth(["Admin","Instructor","Learner"]),updateTest);       // Update test by ID
router.delete("/:id",jwtAuth(["Admin"]), deleteTest);    // Delete test by ID

export default router;
