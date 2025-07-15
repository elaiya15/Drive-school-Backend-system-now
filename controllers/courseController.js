import Course from '../models/CourseSchema.models.js';


// 🔧 Reusable Validation Error Handler
// const handleValidationError = (error, res) => {
//   if (error.name === 'ValidationError') {
//     const errors = Object.values(error.errors).map(err => err.message);
//     return res.status(400).json({ message: 'Validation failed', errors });
//   }

//   if (error.name === 'CastError') {
//     return res.status(400).json({
//       message: `${error.path} must be a valid ${error.kind}`
//     });
//   }

//   console.error('Unhandled Error:', error);
//   return res.status(500).json({ message: 'Internal server error' });
// };

const handleValidationError = (error, res) => {
  const toTitleCase = (str) =>
    str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err) => {
      const field = toTitleCase(err.path || 'Field');

      if (err.name === 'CastError') {
        // Special handling for nested CastError inside ValidationError
        if (err.value === null) {
          return `${field} must not be null`;
        } else if (Array.isArray(err.value)) {
          return `${field} must not be an array`;
        } else {
          return `${field} must be a valid ${err.kind}`;
        }
      } 

      return `${field} is invalid: ${err.message}`;
    });

    return res.status(400).json({ message: 'Validation failed', errors });
  }

  if (error.name === 'CastError') {
    const field = toTitleCase(error.path || 'Field');
    let message;

    if (error.value === null) {
      message = `${field} must not be null`;
    } else if (Array.isArray(error.value)) {
      message = `${field} must not be an array`;
    } else {
      message = `${field} must be a valid ${error.kind}`;
    }

    return res.status(400).json({
      message: 'Validation failed',
      errors: [message],
    });
  }

  console.error('❌ Unhandled Error:', error);
  return res.status(500).json({ message: 'Internal server error' });
};
// 📌 CREATE Course
export const createCourse = async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (error) {
    handleValidationError(error, res);
  }
};


// 📌 GET ALL COURSES (With Pagination & Search)
export const getCourses = async (req, res) => {
  try {
    const { search } = req.query;
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    // If page & limit are missing, fetch all courses
    const paginate = !isNaN(page) && !isNaN(limit) && page > 0 && limit > 0;

    let searchFilter = {};

    if (search) {
      const trimmedSearch = search.trim();

      if (!isNaN(trimmedSearch)) {
        // If search input is a number, match numeric fields exactly
        searchFilter.$or = [
          { duration: parseInt(trimmedSearch) },
          { practicalDays: parseInt(trimmedSearch) },
          { theoryDays: parseInt(trimmedSearch) },
          { fee: parseInt(trimmedSearch) }
        ];
      } else {
        // If search input is text, use regex for courseName
        searchFilter.courseName = { $regex: trimmedSearch, $options: "i" };
      }
    }

    // Count total courses (before pagination)
    const totalCourses = await Course.countDocuments(searchFilter);

    let query = Course.find(searchFilter)
    .sort({ createdAt: -1 }) // Ensure LIFO ordering
    .lean(); // Convert to plain object

    // Apply pagination only if page & limit exist
    if (paginate) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    // Fetch courses
    const courses = await query;

    // Send response
    res.status(200).json({
      totalPages: paginate ? Math.ceil(totalCourses / limit) : 1,
      currentPage: paginate ? page : 1,
      totalCourses,
      currentCourses: courses.length,
      courses,
    });

  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};


// Get Course by _id
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params._id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.status(200).json(course);
  } catch (error) {
        handleValidationError(error, res);
  }
};

// Update Course by _id
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params._id, req.body, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.status(200).json(course);
  } catch (error) {
       handleValidationError(error, res);
  }
};

// Delete Course by _id
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params._id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error) {
       handleValidationError(error, res);
  }
};
