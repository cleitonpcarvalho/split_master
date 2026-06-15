import { Router } from "express";

import {
  quizAnswers,
  quizFunnel,
  quizSummary,
  quizTimeline,
  quizUtm,
  summary,
  timeline,
} from "../controllers/analytics.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);
analyticsRouter.get("/summary", summary);
analyticsRouter.get("/timeline", timeline);
analyticsRouter.get("/:quizId/summary", quizSummary);
analyticsRouter.get("/:quizId/timeline", quizTimeline);
analyticsRouter.get("/:quizId/funnel", quizFunnel);
analyticsRouter.get("/:quizId/answers", quizAnswers);
analyticsRouter.get("/:quizId/utm", quizUtm);
