import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";
import type { ApiResponse } from "../models/api-response.js";
import { AppError } from "../models/app-error.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: Error,
  _request,
  response,
  _next,
) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = getErrorMessage(error, statusCode);

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    success: false,
    error: message,
  } satisfies ApiResponse<never>);
};

function getErrorMessage(error: Error, statusCode: number): string {
  if (statusCode < 500 || env.nodeEnv !== "production") {
    return error.message;
  }

  return "Ocorreu um erro interno no servidor.";
}
