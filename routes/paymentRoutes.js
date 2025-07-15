import express from "express";
import { createPayment, getPayments, getPaymentById, deletePayment } from "../controllers/paymentController.js";
import jwtAuth from "../middlewares/jwtMiddleware.js";
const router = express.Router();

router.post("/", jwtAuth(["Admin","Instructor"]),createPayment);
router.get("/",jwtAuth(["Admin","Instructor","Learner"]), getPayments);
router.get("/createdBy/:createdBy",jwtAuth(["Admin","Instructor"]), getPayments);
router.get("/:id",jwtAuth(["Admin","Instructor","Learner"]), getPayments);
// router.get("/:id",jwtAuth(["Admin","Instructor","Learner"]), getPaymentById);
router.delete("/:id",jwtAuth(["Admin"]), deletePayment);

export default router;
