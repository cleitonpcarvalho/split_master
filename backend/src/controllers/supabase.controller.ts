import type { NextFunction, Request, Response } from "express";

import type { ApiResponse } from "../models/api-response.js";
import {
  getSupabaseStatus,
  type SupabaseStatus,
} from "../services/supabase.service.js";

export async function getSupabaseHealth(
  _request: Request,
  response: Response<ApiResponse<SupabaseStatus>>,
  next: NextFunction,
): Promise<void> {
  try {
    const status = await getSupabaseStatus();

    response.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}
