import express from "express";
import { register, login, refresh, logout, me } from "../authController.js";
import { body } from "express-validator";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

//validation
const registerValidation = [
    body("email").isEmail().withMessage("Email must be Valid!"),
    body("password").isLength({ min: 8}).withMessage("Password should be atleast 8 characters!"),
    body("name").optional().isString()
];

const loginValidation = [
    body("email").isEmail(),
    body("password").exists()
];

router.post("/register", registerValidation, register);
router.post('/login', loginValidation, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;