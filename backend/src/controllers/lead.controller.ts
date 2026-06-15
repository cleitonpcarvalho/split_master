import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import type { LeadDetail, LeadListResponse } from "../models/lead.js";
import {
  exportLeadsCsv,
  getLead,
  listLeadsPage,
} from "../services/lead.service.js";

export async function index(
  request: Request,
  response: Response<ApiResponse<LeadListResponse>>,
  next: NextFunction,
): Promise<void> {
  try {
    const leads = await listLeadsPage(
      requireUser(request),
      parseLeadFilters(request.query),
    );

    response.status(200).json({ success: true, data: leads });
  } catch (error) {
    next(error);
  }
}

export async function show(
  request: Request,
  response: Response<ApiResponse<LeadDetail>>,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseUuid(request.params.id, "ID de lead inválido.");
    const lead = await getLead(requireUser(request), id);

    response.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
}

export async function exportCsv(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const csv = await exportLeadsCsv(
      requireUser(request),
      parseLeadFilters(request.query),
    );

    response
      .status(200)
      .type("text/csv")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="leads-split-master-${Date.now()}.csv"`,
      )
      .send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
}

function requireUser(request: Request) {
  if (!request.user) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  return request.user;
}

function parseOptionalUuid(value: unknown): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return parseUuid(value, "ID de quiz inválido.");
}

function parseLeadFilters(query: Request["query"]) {
  return {
    quizId: parseOptionalUuid(query.quiz_id ?? query.quizId),
    startDate: parseOptionalDate(query.start_date, false),
    endDate: parseOptionalDate(query.end_date, true),
    completed: parseOptionalBoolean(query.completed ?? query.completed_only),
    hasEmail: parseOptionalBoolean(query.has_email ?? query.email_only),
    page: parseOptionalNumber(query.page),
    perPage: parseOptionalNumber(query.per_page ?? query.perPage),
  };
}

function parseOptionalDate(
  value: unknown,
  endOfDay: boolean,
): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const result = z.string().trim().min(8).max(40).safeParse(value);

  if (!result.success) {
    throw new AppError("Data inválida.", 400);
  }

  const date = new Date(result.data);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("Data inválida.", 400);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(result.data)) {
    date.setHours(
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
  }

  return date.toISOString();
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value === "true" || value === "1" || value === true) {
    return true;
  }

  if (value === "false" || value === "0" || value === false) {
    return false;
  }

  throw new AppError("Filtro booleano inválido.", 400);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const result = z.coerce.number().int().positive().safeParse(value);

  if (!result.success) {
    throw new AppError("Número de página inválido.", 400);
  }

  return result.data;
}

function parseUuid(value: unknown, message: string): string {
  const result = z.uuid(message).safeParse(value);

  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? message, 400);
  }

  return result.data;
}
