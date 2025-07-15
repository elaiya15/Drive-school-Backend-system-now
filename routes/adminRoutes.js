import express from "express";
import adminController from "../controllers/adminController.js";
import userController from "../controllers/userController.js";
import jwtAuth from "../middlewares/jwtMiddleware.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const fileFields = [
  { name: "photo", maxCount: 1 }, // 🚨 "photo" instead of "profile"
  { name: "signature", maxCount: 1 },
  { name: "aadharCard", maxCount: 1 },
  { name: "educationCertificate", maxCount: 1 },
  { name: "passport", maxCount: 1 },
  { name: "notary", maxCount: 1 },
];
const fileFieldsInstead = [
  { name: "photo", maxCount: 1 }, // 🚨 "photo" instead of "profile"
];
// Admin routes
router.post("/login", adminController.login);
router.post("/logout", adminController.logout);

router.get("/me", jwtAuth(), (req, res) => {
  res.status(200).json({ user: req.user }); // From decoded JWT
});

// router.post("/forgot-password", adminController.forgotPassword);
// router.post("/verify-otp", adminController.verifyOtp);
// router.post("/change-password", adminController.changePassword);

// User creation route (only accessible by Admin)
router.post(
  "/create-Instructor",jwtAuth(["Admin"]),
  upload.fields(fileFieldsInstead), // Add this middleware
  userController.createInstructor
);


router.post(
  "/create-Learner",
  upload.fields(fileFields), // Add this middleware
  jwtAuth(["Admin"]),
  userController.createLearner
);



export default router;
