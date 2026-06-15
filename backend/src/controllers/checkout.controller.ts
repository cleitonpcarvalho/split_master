import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import {
  checkoutProviders,
  type CheckoutConfig,
} from "../models/checkout.js";
import {
  createCheckoutConfig,
  deleteCheckoutConfig,
  listCheckoutConfigs,
  updateCheckoutConfig,
} from "../services/checkout.service.js";

const idSchema = z.uuid("ID inválido.");
const customParamsSchema = z
  .record(z.string().trim().min(1).max(100), z.string().max(1000))
  .refine((value) => Object.keys(value).length <= 50, {
    message: "Cadastre no máximo 50 parâmetros personalizados.",
  });
const createSchema = z.object({
  provider: z.enum(checkoutProviders),
  checkoutUrl: z.url("Informe uma URL válida.").max(2000),
  urlTemplate: z.string().trim().max(4000).optional(),
  customParams: customParamsSchema.optional(),
  isActive: z.boolean().optional(),
});
const updateSchema = createSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Informe ao menos um campo para atualização." },
);

export async function checkoutIndex(
  request: Request,
  response: Response<ApiResponse<CheckoutConfig[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listCheckoutConfigs(
      requireUser(request),
      parseId(request.params.id),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function checkoutStore(
  request: Request,
  response: Response<ApiResponse<CheckoutConfig>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createCheckoutConfig(
      requireUser(request),
      parseId(request.params.id),
      parse(createSchema, request.body),
    );
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function checkoutUpdate(
  request: Request,
  response: Response<ApiResponse<CheckoutConfig>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await updateCheckoutConfig(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.checkoutId),
      parse(updateSchema, request.body),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function checkoutDestroy(
  request: Request,
  response: Response<ApiResponse<{ deleted: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteCheckoutConfig(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.checkoutId),
    );
    response.status(200).json({ success: true, data: { deleted: true } });
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

function parseId(value: unknown): string {
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
