import type { NextFunction, Request, Response } from "express";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import {
  type AdminDashboardData,
  type ClientDashboardData,
  getDashboard,
} from "../services/dashboard.service.js";

export async function show(
  request: Request,
  response: Response<
    ApiResponse<ClientDashboardData | AdminDashboardData>
  >,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.user) {
      throw new AppError("Usuário não autenticado.", 401);
    }

    const data = await getDashboard(request.user);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
