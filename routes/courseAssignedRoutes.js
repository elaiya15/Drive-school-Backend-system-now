import express from 'express';
import {
  createCourseAssigned,
  getCourseAssigned,
  getCourseAssignedById,
  updateCourseAssigned,
  deleteCourseAssigned,
} from '../controllers/courseAssignedController.js';
import jwtAuth from "../middlewares/jwtMiddleware.js";

const router = express.Router();

router.post('/', jwtAuth(["Admin"]),createCourseAssigned);
router.get('/', jwtAuth(["Admin","Instructor","Learner"]),getCourseAssigned);
router.get('/:id', jwtAuth(["Admin","Instructor","Learner"]),getCourseAssigned);
router.get('/ById/:_id',jwtAuth(["Admin","Instructor","Learner"]), getCourseAssignedById);
router.put('/:_id',jwtAuth(["Admin","Instructor"]), updateCourseAssigned);
router.delete('/:_id',jwtAuth(["Admin"]), deleteCourseAssigned);

export default router;
