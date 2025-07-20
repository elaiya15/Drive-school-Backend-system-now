import Learner from '../models/LearnerSchema.models.js';
import Instructor from '../models/InstructorSchema.models.js';
import Staff from '../models/StaffSchema.models.js';
import Course from '../models/CourseSchema.models.js';

import LearnerAttendance from '../models/Learner_Attendance.models.js';
import InstructorAttendance from '../models/InstructorAttendance.models.js';
import StaffAttendance from '../models/StaffSchema.models.js';

import moment from 'moment';

/** 📊 Admin Dashboard */
export const getAdminDashboard = async (req, res) => {
  try {
    const totalLearners = await Learner.countDocuments();
    // const activeLearners = await Learner.countDocuments({ status: 'active' });
    // const inactiveLearners = totalLearners - activeLearners;
    const instructors = await Instructor.countDocuments();
    const staff = await Staff.countDocuments();
    const courses = await Course.countDocuments();

    // Monthly learner registrations (Jan–Dec)
    const months = moment.monthsShort(); // ['Jan', 'Feb', ..., 'Dec']
    const monthlyAdmissions = await Promise.all(
      months.map(async (month, index) => {
        const start = moment().month(index).startOf('month');
        const end = moment().month(index).endOf('month');

        const count = await Learner.countDocuments({
          createdAt: { $gte: start.toDate(), $lte: end.toDate() }
        });

        return { month, count };
      })
    );

    res.json({
      totalLearners,
      // activeLearners,
      // inactiveLearners,
      instructors,
      staff,
      courses,
      monthlyAdmissions,
    });
  } catch (err) {
    console.error('[AdminDashboard]', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** 👨‍🏫 Instructor Dashboard */
export const getInstructorDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    const assignedLearners = await Learner.countDocuments({ instructor: id });

    const attendanceMarked = await InstructorAttendance.countDocuments({
      instructorId: id,
    });

    const upcomingClasses = await InstructorAttendance.countDocuments({
      instructorId: id,
      date: { $gte: new Date() }
    });

    res.json({
      assignedLearners,
      upcomingClasses,
      attendanceMarked
    });
  } catch (err) {
    console.error('[InstructorDashboard]', err);
    res.status(500).json({ error: 'Server error' });
  }
};


/** 🎓 Learner Dashboard */
export const getLearnerDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    // Get learner by ID
    const learner = await Learner.findById(id);
    if (!learner) {
      return res.status(404).json({ error: 'Learner not found' });
    }

    // Get course details manually using courseId
    const courseId = learner.course; // assuming you have learner.course field as ObjectId
    let course = null;

    if (courseId) {
      course = await Course.findById(courseId);
    }

    // Get attendance details
    const attendedClasses = await LearnerAttendance.countDocuments({ learnerId: id });

    const upcomingClasses = await LearnerAttendance.countDocuments({
      learnerId: id,
      date: { $gte: new Date() }
    });

    res.json({
      assignedCourse: course?.title || 'N/A',
      totalClasses: course?.totalClasses || 0,
      attendedClasses,
      upcomingClasses
    });
  } catch (err) {
    console.error('[LearnerDashboard]', err);
    res.status(500).json({ error: 'Server error' });
  }
};
