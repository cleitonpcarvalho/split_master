import { Router } from "express";

import { accountRouter } from "./account.routes.js";
import { adminRouter } from "./admin.routes.js";
import { analyticsRouter } from "./analytics.routes.js";
import { authRouter } from "./auth.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { healthRouter } from "./health.routes.js";
import { integrationRouter } from "./integration.routes.js";
import { leadRouter } from "./lead.routes.js";
import { questionRouter } from "./question.routes.js";
import { publicRouter } from "./public.routes.js";
import { quizRouter } from "./quiz.routes.js";

export const apiRouter = Router();

apiRouter.use("/account", accountRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/integrations", integrationRouter);
apiRouter.use("/leads", leadRouter);
apiRouter.use("/questions", questionRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/quizzes", quizRouter);
