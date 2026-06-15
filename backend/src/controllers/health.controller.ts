import type { Request, Response } from "express";

import type { ApiResponse } from "../models/api-response.js";

interface HealthData {
  status: "ok";
  timestamp: string;
}

export function getHealth(
  _request: Request,
  response: Response<ApiResponse<HealthData>>,
): void {
  response.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
}
