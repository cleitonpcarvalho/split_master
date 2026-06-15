import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import type {
  PublicLeadSession,
  PublicQuiz,
} from "../models/public-quiz.js";
import {
  createOrResumePublicLead,
  getPublicQuiz,
  registerPublicLeadEvent,
  registerPublicVisit,
  updatePublicLead,
} from "../services/public-quiz.service.js";
import { getPublicCheckoutUrl } from "../services/checkout.service.js";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido.");
const idSchema = z.uuid("ID de lead inválido.");
const optionalCheckoutIdSchema = z
  .uuid("ID de checkout inválido.")
  .optional();
const attributionSchema = z
  .object({
    utmSource: z.string().trim().max(300).optional(),
    utmMedium: z.string().trim().max(300).optional(),
    utmCampaign: z.string().trim().max(300).optional(),
    utmContent: z.string().trim().max(300).optional(),
    utmTerm: z.string().trim().max(300).optional(),
    fbclid: z.string().trim().max(500).optional(),
    gclid: z.string().trim().max(500).optional(),
  })
  .optional();
const stringRecordSchema = z
  .record(z.string().max(100), z.string().max(1000))
  .refine((value) => Object.keys(value).length <= 300, {
    message: "Foram enviadas respostas demais.",
  });
const leadPayloadSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(255),
  name: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  answers: stringRecordSchema,
  variables: stringRecordSchema,
  attribution: attributionSchema,
  website: z.string().max(300).optional().default(""),
});
const createLeadSchema = leadPayloadSchema.extend({
  slug: slugSchema,
});
const updateLeadSchema = leadPayloadSchema.partial({
  email: true,
  name: true,
  phone: true,
  attribution: true,
  website: true,
});
const visitSchema = z.object({
  attribution: attributionSchema,
  website: z.string().max(300).optional().default(""),
});
const eventSchema = z.object({
  type: z.enum(["start", "complete", "cta_click", "checkout_click"]),
  metadata: z
    .record(z.string().max(100), z.unknown())
    .refine((value) => Object.keys(value).length <= 50, {
      message: "Metadados demais.",
    })
    .optional()
    .default({}),
  website: z.string().max(300).optional().default(""),
});

export async function publicQuizShow(
  request: Request,
  response: Response<ApiResponse<PublicQuiz>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getPublicQuiz(parse(slugSchema, request.params.slug));
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function publicQuizVisit(
  request: Request,
  response: Response<ApiResponse<{ registered: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(visitSchema, request.body);
    assertHoneypot(input.website);
    await registerPublicVisit(
      parse(slugSchema, request.params.slug),
      input.attribution ?? {},
      getContext(request),
    );
    response.status(201).json({ success: true, data: { registered: true } });
  } catch (error) {
    next(error);
  }
}

export async function publicLeadStore(
  request: Request,
  response: Response<ApiResponse<PublicLeadSession>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(createLeadSchema, request.body);
    assertHoneypot(input.website);
    const data = await createOrResumePublicLead(input);
    response.status(data.existing ? 200 : 201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function publicLeadUpdate(
  request: Request,
  response: Response<ApiResponse<{ updated: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(updateLeadSchema, request.body);
    assertHoneypot(input.website ?? "");
    await updatePublicLead(
      parse(idSchema, request.params.id),
      getWriteToken(request),
      input,
    );
    response.status(200).json({ success: true, data: { updated: true } });
  } catch (error) {
    next(error);
  }
}

export async function publicLeadEvent(
  request: Request,
  response: Response<ApiResponse<{ registered: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(eventSchema, request.body);
    assertHoneypot(input.website);
    await registerPublicLeadEvent(
      parse(idSchema, request.params.id),
      getWriteToken(request),
      input.type,
      input.metadata,
      getContext(request),
    );
    response.status(201).json({ success: true, data: { registered: true } });
  } catch (error) {
    next(error);
  }
}

export async function publicCheckoutUrl(
  request: Request,
  response: Response<
    ApiResponse<{ url: string; checkoutId: string; provider: string }>
  >,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getPublicCheckoutUrl(
      parse(slugSchema, request.params.slug),
      parse(idSchema, request.query.lead_id),
      getWriteToken(request),
      parse(optionalCheckoutIdSchema, request.query.checkout_id),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function getWriteToken(request: Request): string {
  const result = z
    .uuid("Token público inválido.")
    .safeParse(request.header("x-lead-token"));

  if (!result.success) {
    throw new AppError(
      result.error.issues[0]?.message ?? "Token público inválido.",
      401,
    );
  }

  return result.data;
}

function getContext(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.header("user-agent"),
  };
}

function assertHoneypot(value: string): void {
  if (value.trim()) {
    throw new AppError("Solicitação inválida.", 400);
  }
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
