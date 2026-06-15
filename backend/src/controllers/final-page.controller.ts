import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import {
  finalPageBlockTypes,
  type FinalPageBlock,
} from "../models/final-page.js";
import {
  createFinalPageBlock,
  deleteFinalPageBlock,
  listFinalPageBlocks,
  reorderFinalPageBlocks,
  updateFinalPageBlock,
  uploadFinalPageImage,
} from "../services/final-page.service.js";

const idSchema = z.uuid("ID inválido.");
const createSchema = z.object({
  type: z.enum(finalPageBlockTypes),
  afterBlockId: z.uuid("Bloco de referência inválido.").optional(),
});
const updateSchema = z
  .object({
    content: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });
const reorderSchema = z.object({
  ids: z.array(z.uuid("A lista contém um ID inválido.")).max(500),
});

export async function finalPageIndex(
  request: Request,
  response: Response<ApiResponse<FinalPageBlock[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listFinalPageBlocks(
      requireUser(request),
      parseId(request.params.id),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function finalPageBlockStore(
  request: Request,
  response: Response<ApiResponse<FinalPageBlock[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(createSchema, request.body);
    const data = await createFinalPageBlock(
      requireUser(request),
      parseId(request.params.id),
      input.type,
      input.afterBlockId,
    );
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function finalPageBlockUpdate(
  request: Request,
  response: Response<ApiResponse<FinalPageBlock>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await updateFinalPageBlock(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.blockId),
      parse(updateSchema, request.body),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function finalPageBlockDestroy(
  request: Request,
  response: Response<ApiResponse<FinalPageBlock[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await deleteFinalPageBlock(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.blockId),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function finalPageBlockReorder(
  request: Request,
  response: Response<ApiResponse<FinalPageBlock[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(reorderSchema, request.body);
    const data = await reorderFinalPageBlocks(
      requireUser(request),
      parseId(request.params.id),
      input.ids,
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function finalPageImageUpload(
  request: Request,
  response: Response<ApiResponse<{ url: string; path: string }>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.file) {
      throw new AppError("Selecione uma imagem.", 400);
    }

    const data = await uploadFinalPageImage(
      requireUser(request),
      parseId(request.params.id),
      request.file,
    );
    response.status(201).json({ success: true, data });
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
