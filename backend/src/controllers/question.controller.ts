import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import {
  optionNextSteps,
  type QuestionOption,
  questionTypes,
  type QuizQuestion,
} from "../models/question.js";
import {
  createOption,
  createQuestion,
  deleteOption,
  deleteQuestion,
  listQuestions,
  reorderOptions,
  reorderQuestions,
  updateOption,
  updateQuestion,
} from "../services/question.service.js";

const idSchema = z.uuid("ID inválido.");
const variableSchema = z
  .string()
  .trim()
  .max(80)
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    "Use letras, números e underscore no nome da variável.",
  )
  .nullable();
const createQuestionSchema = z.object({
  title: z.string().trim().min(2).max(240).optional(),
  type: z.enum(questionTypes).optional(),
});
const updateQuestionSchema = z
  .object({
    title: z.string().trim().min(2).max(240).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    type: z.enum(questionTypes).optional(),
    variableName: variableSchema.optional(),
    isRequired: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });
const createOptionSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
  value: z.string().trim().min(1).max(160).optional(),
});
const updateOptionSchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    value: z.string().trim().min(1).max(160).optional(),
    variableValue: z.string().trim().max(160).nullable().optional(),
    nextStep: z.enum(optionNextSteps).optional(),
    nextQuestionId: z.uuid("Pergunta de destino inválida.").nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });
const reorderSchema = z.object({
  ids: z.array(z.uuid("A lista contém um ID inválido.")).max(500),
});

export async function questionIndex(
  request: Request,
  response: Response<ApiResponse<QuizQuestion[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listQuestions(
      requireUser(request),
      parseId(request.params.id),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function questionStore(
  request: Request,
  response: Response<ApiResponse<QuizQuestion>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createQuestion(
      requireUser(request),
      parseId(request.params.id),
      parse(createQuestionSchema, request.body),
    );
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function questionUpdate(
  request: Request,
  response: Response<ApiResponse<QuizQuestion>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await updateQuestion(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.questionId),
      parse(updateQuestionSchema, request.body),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function questionDestroy(
  request: Request,
  response: Response<ApiResponse<{ deleted: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteQuestion(
      requireUser(request),
      parseId(request.params.id),
      parseId(request.params.questionId),
    );
    response.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function questionReorder(
  request: Request,
  response: Response<ApiResponse<QuizQuestion[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(reorderSchema, request.body);
    const data = await reorderQuestions(
      requireUser(request),
      parseId(request.params.id),
      input.ids,
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function optionStore(
  request: Request,
  response: Response<ApiResponse<QuestionOption>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createOption(
      requireUser(request),
      parseId(request.params.questionId),
      parse(createOptionSchema, request.body),
    );
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function optionUpdate(
  request: Request,
  response: Response<ApiResponse<QuestionOption>>,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await updateOption(
      requireUser(request),
      parseId(request.params.questionId),
      parseId(request.params.optionId),
      parse(updateOptionSchema, request.body),
    );
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function optionDestroy(
  request: Request,
  response: Response<ApiResponse<{ deleted: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteOption(
      requireUser(request),
      parseId(request.params.questionId),
      parseId(request.params.optionId),
    );
    response.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function optionReorder(
  request: Request,
  response: Response<ApiResponse<QuestionOption[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(reorderSchema, request.body);
    const data = await reorderOptions(
      requireUser(request),
      parseId(request.params.questionId),
      input.ids,
    );
    response.status(200).json({ success: true, data });
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
