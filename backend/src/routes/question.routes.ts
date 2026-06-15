import { Router } from "express";

import {
  optionDestroy,
  optionReorder,
  optionStore,
  optionUpdate,
} from "../controllers/question.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const questionRouter = Router();

questionRouter.use(authenticate);
questionRouter.post("/:questionId/options", optionStore);
questionRouter.put("/:questionId/options/reorder", optionReorder);
questionRouter.put("/:questionId/options/:optionId", optionUpdate);
questionRouter.delete("/:questionId/options/:optionId", optionDestroy);
