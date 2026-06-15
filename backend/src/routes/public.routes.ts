import { Router } from "express";

import {
  publicLeadEvent,
  publicLeadStore,
  publicLeadUpdate,
  publicCheckoutUrl,
  publicQuizShow,
  publicQuizVisit,
} from "../controllers/public.controller.js";
import {
  createPublicCreationLimiter,
  publicUpdateLimiter,
} from "../middlewares/public-rate-limit.middleware.js";

export const publicRouter = Router();
const visitLimiter = createPublicCreationLimiter();
const leadCreationLimiter = createPublicCreationLimiter();
const eventLimiter = createPublicCreationLimiter();

publicRouter.get("/quiz/:slug", publicQuizShow);
publicRouter.get(
  "/quiz/:slug/checkout-url",
  publicUpdateLimiter,
  publicCheckoutUrl,
);
publicRouter.post(
  "/quiz/:slug/visit",
  visitLimiter,
  publicQuizVisit,
);
publicRouter.post("/leads", leadCreationLimiter, publicLeadStore);
publicRouter.put("/leads/:id", publicUpdateLimiter, publicLeadUpdate);
publicRouter.post(
  "/leads/:id/event",
  eventLimiter,
  publicLeadEvent,
);
