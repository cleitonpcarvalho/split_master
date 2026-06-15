import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import {
  integrationTypes,
  type ActiveCampaignField,
  type ActiveCampaignList,
  type ActiveCampaignTag,
  type Integration,
} from "../models/integration.js";
import {
  getActiveCampaignFields,
  getActiveCampaignLists,
  getActiveCampaignTags,
  testActiveCampaignConnection,
} from "../services/activecampaign.service.js";
import {
  deleteIntegration,
  listIntegrations,
  resolveActiveCampaignCredentials,
  saveIntegration,
} from "../services/integration.service.js";
import { testWebhook } from "../services/webhook.service.js";

const idSchema = z.uuid("ID inválido.");
const headersSchema = z.record(z.string().max(100), z.string().max(500));
const activeCampaignSettingsSchema = z.object({
  apiUrl: z.url("Informe uma API URL válida."),
  apiKey: z.string().trim().min(1).max(500).optional(),
  listId: z.string().trim().max(80).nullable().optional(),
  defaultTags: z.array(z.string().trim().max(120)).max(100).optional(),
  fieldMappings: z
    .array(
      z.object({
        variable: z
          .string()
          .trim()
          .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Variável inválida."),
        fieldId: z.string().trim().min(1).max(80),
      }),
    )
    .max(100)
    .optional(),
  answerTags: z
    .array(
      z.object({
        questionId: z.uuid("Pergunta inválida."),
        optionValue: z.string().trim().min(1).max(200),
        tag: z.string().trim().min(1).max(120),
      }),
    )
    .max(500)
    .optional(),
});
const webhookSettingsSchema = z.object({
  url: z.url("Informe uma URL válida."),
  method: z.enum(["POST", "GET"]),
  headers: headersSchema.optional().default({}),
});
const pixelSettingsSchema = z.object({
  pixelId: z.string().trim().min(1).max(80),
});
const saveSchema = z.object({
  quizId: idSchema,
  type: z.enum(integrationTypes),
  settings: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});
const activeCredentialSchema = z.object({
  quizId: idSchema.optional(),
  apiUrl: z.url("Informe uma API URL válida.").optional(),
  apiKey: z.string().trim().min(1).max(500).optional(),
});

export async function index(
  request: Request,
  response: Response<ApiResponse<Integration[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listIntegrations(requireUser(request), {
      quizId: parseOptionalId(request.query.quizId),
    });
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function store(
  request: Request,
  response: Response<ApiResponse<Integration>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(saveSchema, request.body);
    const settings = parseSettings(input.type, input.settings);
    const data = await saveIntegration(requireUser(request), {
      ...input,
      settings,
    });
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function destroy(
  request: Request,
  response: Response<ApiResponse<{ deleted: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteIntegration(requireUser(request), parse(idSchema, request.params.id));
    response.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function activeCampaignTest(
  request: Request,
  response: Response<
    ApiResponse<{
      connected: true;
      lists: ActiveCampaignList[];
      tags: ActiveCampaignTag[];
      fields: ActiveCampaignField[];
    }>
  >,
  next: NextFunction,
): Promise<void> {
  try {
    const credentials = await resolveActiveCampaignCredentials(
      requireUser(request),
      parse(activeCredentialSchema, request.body),
    );
    const data = await testActiveCampaignConnection(credentials);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function activeCampaignLists(
  request: Request,
  response: Response<ApiResponse<ActiveCampaignList[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const credentials = await getCredentialsFromRequest(request);
    response.status(200).json({
      success: true,
      data: await getActiveCampaignLists(credentials),
    });
  } catch (error) {
    next(error);
  }
}

export async function activeCampaignTags(
  request: Request,
  response: Response<ApiResponse<ActiveCampaignTag[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const credentials = await getCredentialsFromRequest(request);
    response.status(200).json({
      success: true,
      data: await getActiveCampaignTags(credentials),
    });
  } catch (error) {
    next(error);
  }
}

export async function activeCampaignFields(
  request: Request,
  response: Response<ApiResponse<ActiveCampaignField[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const credentials = await getCredentialsFromRequest(request);
    response.status(200).json({
      success: true,
      data: await getActiveCampaignFields(credentials),
    });
  } catch (error) {
    next(error);
  }
}

export async function webhookTest(
  request: Request,
  response: Response<ApiResponse<{ delivered: true; status: number }>>,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = parse(webhookSettingsSchema, request.body);
    const data = await testWebhook(settings);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getCredentialsFromRequest(request: Request) {
  return resolveActiveCampaignCredentials(requireUser(request), {
    quizId: parseOptionalId(request.query.quizId),
    apiUrl: request.header("x-activecampaign-api-url") ?? undefined,
    apiKey: request.header("x-activecampaign-api-key") ?? undefined,
  });
}

function parseSettings(
  type: (typeof integrationTypes)[number],
  settings: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "activecampaign") {
    return parse(activeCampaignSettingsSchema, settings);
  }
  if (type === "webhook") {
    return parse(webhookSettingsSchema, settings);
  }
  if (type === "pixel_facebook") {
    return parse(
      pixelSettingsSchema.refine((value) => /^\d{5,30}$/.test(value.pixelId), {
        message: "Informe um Facebook Pixel ID válido.",
      }),
      settings,
    );
  }
  if (type === "gtm") {
    return parse(
      pixelSettingsSchema.refine(
        (value) => /^GTM-[A-Z0-9]+$/i.test(value.pixelId),
        { message: "Informe um GTM ID válido." },
      ),
      settings,
    );
  }

  return parse(
    pixelSettingsSchema.refine(
      (value) => /^G-[A-Z0-9]+$/i.test(value.pixelId),
      { message: "Informe um GA4 Measurement ID válido." },
    ),
    settings,
  );
}

function requireUser(request: Request) {
  if (!request.user) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  return request.user;
}

function parseOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return parse(idSchema, value);
}

function parse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  return result.data;
}
