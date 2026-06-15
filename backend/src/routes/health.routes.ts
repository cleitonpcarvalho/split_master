import { Router } from "express";

import { getHealth } from "../controllers/health.controller.js";
import { getSupabaseHealth } from "../controllers/supabase.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/supabase", getSupabaseHealth);
