import express from 'express';
import { createAttendance, getAllAttendances, getAttendanceById, updateAttendance, deleteAttendance } from '../controllers/learnerAttendanceController.js';
import jwtAuth from "../middlewares/jwtMiddleware.js";
const router = express.Router();

router.post('/', jwtAuth(["Admin","Instructor"]),createAttendance);
router.get('/', jwtAuth(["Admin","Instructor","Learner"]),getAllAttendances); 
router.get('/:id', jwtAuth(["Admin","Instructor","Learner"]),getAllAttendances); 
router.get('/createdBy/:createdBy', jwtAuth(["Admin","Instructor"]),getAllAttendances); 
// router.get('/:id',jwtAuth(["Admin","Instructor","Learner"]), getAttendanceById);
router.put('/:id',jwtAuth(["Admin","Instructor"]), updateAttendance);
router.delete('/:id',jwtAuth(["Admin"]), deleteAttendance);

export default router;
