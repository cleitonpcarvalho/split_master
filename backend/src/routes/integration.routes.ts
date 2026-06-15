import { Router } from "express";

import {
  activeCampaignFields,
  activeCampaignLists,
  activeCampaignTags,
  activeCampaignTest,
  destroy,
  index,
  store,
  webhookTest,
} from "../controllers/integration.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export const integrationRouter = Router();

integrationRouter.use(authenticate);
integrationRouter.get("/", index);
integrationRouter.post("/", store);
integrationRouter.delete("/:id", destroy);
integrationRouter.post("/activecampaign/test", activeCampaignTest);
integrationRouter.get("/activecampaign/lists", activeCampaignLists);
integrationRouter.get("/activecampaign/tags", activeCampaignTags);
integrationRouter.get("/activecampaign/fields", activeCampaignFields);
integrationRouter.post("/webhook/test", webhookTest);
