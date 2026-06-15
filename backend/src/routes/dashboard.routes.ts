import { Router } from "express";

import { show } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, show);
