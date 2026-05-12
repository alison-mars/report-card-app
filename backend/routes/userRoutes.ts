import { Router } from "express";
import { getUser, register, login, verifyOtp, getProfileStatus, completeUserProfile, completeTeacherProfile } from "../controllers/userControllers";
import { isAuthenticated } from "../middlewares/auth";

const userRouter = Router();

userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.post("/verify-otp", verifyOtp);
userRouter.get("/user", isAuthenticated, getUser);
userRouter.get("/profile-status", isAuthenticated, getProfileStatus);
userRouter.post("/complete-profile", isAuthenticated, completeUserProfile);
userRouter.post("/complete-teacher-profile", isAuthenticated, completeTeacherProfile);

export default userRouter;