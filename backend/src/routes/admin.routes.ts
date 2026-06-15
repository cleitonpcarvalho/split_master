import { Router } from "express";

import {
  updateUser,
  userQuizzes,
  users,
} from "../controllers/admin.controller.js";
import {
  authenticate,
  isAdmin,
} from "../middlewares/auth.middleware.js";

export const adminRouter = Router();

adminRouter.use(authenticate, isAdmin);
adminRouter.get("/users", users);
adminRouter.put("/users/:id", updateUser);
adminRouter.get("/users/:id/quizzes", userQuizzes);
