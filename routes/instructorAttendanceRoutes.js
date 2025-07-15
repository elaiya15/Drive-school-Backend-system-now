import express from 'express';
import {
  createInstructorAttendance,
  getAllInstructorAttendances,
  getInstructorAttendanceById,
  updateInstructorAttendance,
  deleteInstructorAttendance,
} from '../controllers/instructorAttendanceController.js';
import jwtAuth from "../middlewares/jwtMiddleware.js";
const router = express.Router();

router.post('/',jwtAuth(["Admin","Instructor"]), createInstructorAttendance); // Create attendance
router.get('/', jwtAuth(["Admin","Instructor","Learner"]),getAllInstructorAttendances); // Get all attendances
router.get('/:id',jwtAuth(["Admin","Instructor","Learner"]), getAllInstructorAttendances); // Get attendance by ID
// router.get('/:id',jwtAuth(["Admin","Instructor","Learner"]), getInstructorAttendanceById); // Get attendance by ID
router.put('/:id',jwtAuth(["Admin","Instructor"]), updateInstructorAttendance); // Update attendance
router.delete('/:id',jwtAuth(["Admin"]), deleteInstructorAttendance); // Delete attendance

export default router;
