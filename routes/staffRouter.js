
import express from "express";
import adminController from "../controllers/adminController.js";
import {createStaff,getAllStaff,getStaffById,updateStaff,deleteStaff} from "../controllers/staff.js";
import jwtAuth from "../middlewares/jwtMiddleware.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// console.log(upload.fields);


const fileFieldsInstead = [
  { name: "photo", maxCount: 1 }, // 🚨 "photo" instead of "profile"
];

router.post("/create",jwtAuth(["Admin"]),upload.fields(fileFieldsInstead),createStaff);

// get all data
router.get("/", jwtAuth(["Admin"]), getAllStaff);


// get single data
router.get("/:id",jwtAuth(["Admin"]), getStaffById);
// router.get("/:id",jwtAuth(["Admin"]), getStaffById);

// UPDATE
router.put("/:id",jwtAuth(["Admin"]),upload.fields(fileFieldsInstead),updateStaff);

// DELETE
router.delete("/:id",jwtAuth(["Admin"]),deleteStaff);

export default router;
