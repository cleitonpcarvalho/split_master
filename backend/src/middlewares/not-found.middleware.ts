import type { NextFunction, Request, Response } from "express";

import { AppError } from "../models/app-error.js";

export function notFoundMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const error = new AppError(
    `Rota não encontrada: ${request.method} ${request.originalUrl}`,
    404,
  );

  next(error);
}
