import { Router } from "express";

import {
  exportCsv,
  index,
  show,
} from "../controllers/lead.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const leadRouter = Router();

leadRouter.use(authenticate);
leadRouter.get("/export/csv", exportCsv);
leadRouter.get("/", index);
leadRouter.get("/:id", show);
