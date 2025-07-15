import express from 'express';
import {
  createStaffAttendance,
  getAllStaffAttendances,
  getStaffAttendanceById,
  updateStaffAttendance,
  deleteStaffAttendance
} from '../controllers/staffAttendance.js';
import jwtAuth from "../middlewares/jwtMiddleware.js";

const router = express.Router();

router.post('/',jwtAuth(["Admin"]), createStaffAttendance);
router.get('/', jwtAuth(["Admin"]), getAllStaffAttendances);
router.get('/:id', jwtAuth(["Admin"]), getAllStaffAttendances);
// router.get('/:id', jwtAuth(["Admin"]), getStaffAttendanceById);
router.put('/:id', jwtAuth(["Admin"]), updateStaffAttendance);
router.delete('/:id', jwtAuth(["Admin"]), deleteStaffAttendance);

export default router;
