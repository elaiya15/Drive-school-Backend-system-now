import express from 'express';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController.js';
import jwtAuth from "../middlewares/jwtMiddleware.js";
const router = express.Router();

router.post('/', jwtAuth(["Admin"]),createCourse);
router.get('/', jwtAuth(["Admin","Instructor","Learner"]),getCourses);
router.get('/:_id', jwtAuth(["Admin","Instructor","Learner"]), getCourseById);
router.put('/:_id',jwtAuth(["Admin"]), updateCourse);
router.delete('/:_id',jwtAuth(["Admin"]), deleteCourse);

export default router;
