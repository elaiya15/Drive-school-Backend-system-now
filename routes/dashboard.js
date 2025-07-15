import express from 'express';
import {
  getAdminDashboard,
  getInstructorDashboard,
  getLearnerDashboard
} from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/admin', getAdminDashboard);
router.get('/instructor/:id', getInstructorDashboard);
router.get('/learner/:id', getLearnerDashboard);

export default router;
