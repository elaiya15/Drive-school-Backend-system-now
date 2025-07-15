import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
// import DbConnection from "./config/db.js";
import { connectToDatabase } from "./config/db.js"; 
// import  "./config/db.js";
import adminCombinedRoutes from "./routes/adminCombinedRoutes/adminCombinedRoutes.js";
import userCombinedRoutes from "./routes/userCombinedRoutes/userCombinedRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import UserRouter from "./routes/UserRouter.js";
import courseRoutes from "./routes/courseRoutes.js";
import courseAssignedRoutes from "./routes/courseAssignedRoutes.js";
import learnerAttendanceRoutes from './routes/learnerAttendanceRoutes.js';
import instructorAttendanceRoutes from './routes/instructorAttendanceRoutes.js';
import paymentRoutes from "./routes/paymentRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import {sendSMS} from "./util/otp-service.js";
import staffAttendanceRoutes from './routes/staffAttendanceRoutes.js';
import staffRouter from './routes/staffRouter.js';
// import uploadRoutes from "./routes/uploadRoutes.js";
import axios from "axios";
// import adminRoutes from "./routes/"; 
import helmet from "helmet";
import imageProxyRoutes from './routes/imageProxyRoutes.js';
import cookieParser from "cookie-parser";
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();



// Middleware
app.use(express.json()); // For JSON requests
app.use(express.urlencoded({ extended: true })); // For Form-Data requests

const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL_1,
];

app.use(cors({
  origin: (origin, callback) => {
    //  console.log("CORS Origin Attempt:", origin); // ⬅️ debug here
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(cookieParser());

// Add the new route

// Routes
app.get("/", (req, res) => res.send("Server running"));

app.use("/api/image-proxy", imageProxyRoutes);

//
// app.use("/api/upload", uploadRoutes);
// app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminCombinedRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use("/api/user", userCombinedRoutes);
// app.use("/api/user", UserRouter);
// app.use("/api/auth", adminRoutes);
app.use('/api/courses', courseRoutes); 
app.use('/api/course-assigned', courseAssignedRoutes);
app.use('/api/learner-attendance', learnerAttendanceRoutes);
app.use('/api/instructor-attendance', instructorAttendanceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tests", testRoutes);
app.use('/api/staff', staffRouter);
app.use('/api/staff-attendance', staffAttendanceRoutes);

// Connect to Database



// Start the server (Important for Vercel)
const PORT = process.env.PORT || 5000; 
// ✅ Connect to DB and start server
connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("✅ Database connected successfully");
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1); // Exit process if DB connection fails
  });

// // Example Usage:
// const otpCode = '5599';
// const phoneList = ['9943751226'];

// sendSMS(otpCode, phoneList).catch(console.error);
export default app;
