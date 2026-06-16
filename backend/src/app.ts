import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

function normalizeOrigin(origin: string): string {
  const trimmedOrigin = origin.trim().replace(/\/$/, "");

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    return trimmedOrigin;
  }
}

const configuredFrontendOrigins = env.frontendUrl
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedCorsOrigins = new Set([
  "http://localhost:3000",
  "https://splitmasterfrontend-production.up.railway.app",
  ...configuredFrontendOrigins,
]);

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
