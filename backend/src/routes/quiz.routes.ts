import { Router } from "express";

import {
  destroy,
  duplicate,
  index,
  show,
  store,
  update,
} from "../controllers/quiz.controller.js";
import {
  questionDestroy,
  questionIndex,
  questionReorder,
  questionStore,
  questionUpdate,
} from "../controllers/question.controller.js";
import { logoUpload } from "../controllers/quiz-logo.controller.js";
import {
  finalPageBlockDestroy,
  finalPageBlockReorder,
  finalPageBlockStore,
  finalPageBlockUpdate,
  finalPageImageUpload,
  finalPageIndex,
} from "../controllers/final-page.controller.js";
import {
  checkoutDestroy,
  checkoutIndex,
  checkoutStore,
  checkoutUpdate,
} from "../controllers/checkout.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  uploadFinalPageImageFile,
  uploadQuizLogoFile,
} from "../middlewares/upload.middleware.js";

export const quizRouter = Router();

quizRouter.use(authenticate);
quizRouter.get("/", index);
quizRouter.post("/", store);
quizRouter.get("/:id/questions", questionIndex);
quizRouter.post("/:id/questions", questionStore);
quizRouter.put("/:id/questions/reorder", questionReorder);
quizRouter.put("/:id/questions/:questionId", questionUpdate);
quizRouter.delete("/:id/questions/:questionId", questionDestroy);
quizRouter.get("/:id/final-page", finalPageIndex);
quizRouter.post("/:id/final-page/blocks", finalPageBlockStore);
quizRouter.put("/:id/final-page/blocks/reorder", finalPageBlockReorder);
quizRouter.put("/:id/final-page/blocks/:blockId", finalPageBlockUpdate);
quizRouter.delete("/:id/final-page/blocks/:blockId", finalPageBlockDestroy);
quizRouter.post(
  "/:id/final-page/images",
  uploadFinalPageImageFile,
  finalPageImageUpload,
);
quizRouter.get("/:id/checkout", checkoutIndex);
quizRouter.post("/:id/checkout", checkoutStore);
quizRouter.put("/:id/checkout/:checkoutId", checkoutUpdate);
quizRouter.delete("/:id/checkout/:checkoutId", checkoutDestroy);
quizRouter.post("/:id/logo", uploadQuizLogoFile, logoUpload);
quizRouter.get("/:id", show);
quizRouter.put("/:id", update);
quizRouter.delete("/:id", destroy);
quizRouter.post("/:id/duplicate", duplicate);
