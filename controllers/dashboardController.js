import Learner from '../models/LearnerSchema.models.js';
import Instructor from '../models/InstructorSchema.models.js';
import Staff from '../models/StaffSchema.models.js';
import Course from '../models/CourseSchema.models.js';
import CourseAssigned from '../models/CourseAssigned.models.js';

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
// export const getLearnerDashboard = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Get learner by ID
//     const learner = await CourseAssigned.find({learner:id});
//     if (!learner) {
//       return res.status(404).json({ error: ' Course not found' });
//     }

//     console.log(learner);
    
//     // Get course details manually using courseId
//     const courseId = learner.course; // assuming you have learner.course field as ObjectId
//     let course = null;

//     if (courseId) {
//       course = await Course.findById(courseId);
//     }

//     // Get attendance details
//     const attendedClasses = await LearnerAttendance.countDocuments({ learnerId: id });

//     const upcomingClasses = await LearnerAttendance.countDocuments({
//       learnerId: id,
//       date: { $gte: new Date() }
//     });

//     res.json({
//       assignedCourse: course?.title || 'N/A',
//       totalClasses: course?.totalClasses || 0,
//       attendedClasses,
//       upcomingClasses
//     });
//   } catch (err) {
//     console.error('[LearnerDashboard]', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };
// export const getLearnerDashboard = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Get all assigned courses for the learner
//     const assignedCourses = await CourseAssigned.find({ learner: id });

//     const totalCourse = assignedCourses.length;

//     const CompletedCourse = assignedCourses.filter(
//       (course) => course.statusOne === 'Completed'
//     ).length;

//     const ActiveCourse = totalCourse - CompletedCourse;

//     // Get course details for all assigned courseIds
//     const courseIds = assignedCourses.map((c) => c.course);
//     const courses = await Course.find({ _id: { $in: courseIds } });

//     // Calculate totalClasses from all assigned courses
//     let totalClasses = 0;
//     for (const course of courses) {
//       const theory = course.theoryDays || 0;
//       const practical = course.practicalDays || 0;
//       totalClasses += theory + practical;
//     }

//     // Attendance counts
//     const attendedClasses = await LearnerAttendance.countDocuments({
//       learner: id,
//     });

//     const upcomingClasses = await LearnerAttendance.countDocuments({
//       learner: id,
//       date: { $gte: new Date() },
//     });

//     return res.json({
//       totalCourse: totalCourse.toString(),
//       CompletedCourse: CompletedCourse.toString(),
//       ActiveCourse: ActiveCourse.toString(),
//       totalClasses,
//       attendedClasses,
//       upcomingClasses,
//     });
//   } catch (err) {
//     console.error('[LearnerDashboard]', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

export const getLearnerDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch all assigned courses for learner
    const assignedCourses = await CourseAssigned.find({ learner: id });

    const totalCourse = assignedCourses.length;

    const completedCourses = assignedCourses.filter(
      (course) => course.statusOne === 'Completed'
    );

    const activeCourses = assignedCourses.filter(
      (course) => course.statusOne !== 'Completed'
    );

    const CompletedCourse = completedCourses.length;
    const ActiveCourse = activeCourses.length;

    // Get course IDs of active courses
    const activeCourseIds = activeCourses.map((c) => c.course);

    // Fetch course details for active courses
    const activeCourseDetails = await Course.find({
      _id: { $in: activeCourseIds },
    });

    
    //  return
    // Calculate total classes only from active courses
    let ActiveClasses = 0;
    for (const course of activeCourseDetails) {
      const theory = course.theoryDays || 0;
      const practical = course.practicalDays || 0;
      ActiveClasses += theory + practical;
    }

    // Attendance counts only for active courses
    const attendedClasses = await LearnerAttendance.countDocuments({
      learner: id,
      courseType: { $in: activeCourseIds },
    });

    // return 
    const upcomingClasses = ActiveClasses - attendedClasses;

    return res.json({
      totalCourse: totalCourse.toString(),
      CompletedCourse: CompletedCourse.toString(),
      ActiveCourse: ActiveCourse.toString(),
      ActiveClasses,
      attendedClasses,
      upcomingClasses,
    });
  } catch (err) {
    console.error('[LearnerDashboard]', err);
    res.status(500).json({ error: 'Server error' });
  }
};
