import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import type {
  AnalyticsAnswerDistribution,
  AnalyticsFilters,
  AnalyticsFunnelStep,
  AnalyticsQuizSummary,
  AnalyticsSummary,
  AnalyticsTimelinePoint,
  AnalyticsUtmDistribution,
} from "../models/analytics.js";
import type { ApiResponse } from "../models/api-response.js";
import { AppError } from "../models/app-error.js";
import {
  getAnalyticsSummary,
  getAnalyticsTimeline,
  getQuizAnalyticsFunnel,
  getQuizAnalyticsSummary,
  getQuizAnalyticsTimeline,
  getQuizAnswerDistribution,
  getQuizUtmDistribution,
} from "../services/analytics.service.js";

const idSchema = z.uuid("ID de quiz inválido.");

export async function summary(
  request: Request,
  response: Response<ApiResponse<AnalyticsSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseFilters(request.query);
    const data = await getAnalyticsSummary(requireUser(request), filters);

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function timeline(
  request: Request,
  response: Response<ApiResponse<AnalyticsTimelinePoint[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseFilters(request.query);
    const data = await getAnalyticsTimeline(requireUser(request), filters);

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function quizSummary(
  request: Request,
  response: Response<ApiResponse<AnalyticsQuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quizId = parseQuizId(request.params.quizId);
    const data = await getQuizAnalyticsSummary(
      requireUser(request),
      quizId,
      parseFilters(request.query, quizId),
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function quizTimeline(
  request: Request,
  response: Response<ApiResponse<AnalyticsTimelinePoint[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quizId = parseQuizId(request.params.quizId);
    const data = await getQuizAnalyticsTimeline(
      requireUser(request),
      quizId,
      parseFilters(request.query, quizId),
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function quizFunnel(
  request: Request,
  response: Response<ApiResponse<AnalyticsFunnelStep[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quizId = parseQuizId(request.params.quizId);
    const data = await getQuizAnalyticsFunnel(
      requireUser(request),
      quizId,
      parseFilters(request.query, quizId),
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function quizAnswers(
  request: Request,
  response: Response<ApiResponse<AnalyticsAnswerDistribution[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quizId = parseQuizId(request.params.quizId);
    const data = await getQuizAnswerDistribution(
      requireUser(request),
      quizId,
      parseFilters(request.query, quizId),
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function quizUtm(
  request: Request,
  response: Response<ApiResponse<AnalyticsUtmDistribution[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quizId = parseQuizId(request.params.quizId);
    const data = await getQuizUtmDistribution(
      requireUser(request),
      quizId,
      parseFilters(request.query, quizId),
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function parseFilters(
  query: Request["query"],
  forcedQuizId?: string,
): AnalyticsFilters {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 6);
  defaultStart.setHours(0, 0, 0, 0);

  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 59, 999);

  const startDate = parseDate(query.start_date, defaultStart, false);
  const endDate = parseDate(query.end_date, defaultEnd, true);
  const quizId = forcedQuizId ?? parseOptionalQuizId(query.quiz_id ?? query.quizId);

  if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    throw new AppError("A data inicial deve ser anterior à data final.", 400);
  }

  return {
    startDate,
    endDate,
    ...(quizId ? { quizId } : {}),
  };
}

function parseDate(
  value: unknown,
  fallback: Date,
  endOfDay: boolean,
): string {
  if (value === undefined || value === "") {
    return fallback.toISOString();
  }

  const result = z.string().trim().min(8).max(40).safeParse(value);

  if (!result.success) {
    throw new AppError("Data inválida.", 400);
  }

  const date = new Date(result.data);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("Data inválida.", 400);
  }

  // Inputs YYYY-MM-DD não carregam horário; ajustamos para incluir o dia inteiro.
  if (/^\d{4}-\d{2}-\d{2}$/.test(result.data)) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  return date.toISOString();
}

function parseQuizId(value: unknown): string {
  const result = idSchema.safeParse(value);

  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "ID inválido.", 400);
  }

  return result.data;
}

function parseOptionalQuizId(value: unknown): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return parseQuizId(value);
}

function requireUser(request: Request) {
  if (!request.user) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  return request.user;
}
