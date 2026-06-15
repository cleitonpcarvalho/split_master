import { Router } from "express";

import {
  password,
  profile,
} from "../controllers/account.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const accountRouter = Router();

accountRouter.use(authenticate);
accountRouter.put("/profile", profile);
accountRouter.put("/password", password);
