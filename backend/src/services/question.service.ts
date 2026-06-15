import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import {
  type OptionNextStep,
  type QuestionOption,
  type QuestionOptionRow,
  type QuestionRow,
  type QuestionType,
  type QuizQuestion,
} from "../models/question.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import { findAccessibleQuiz } from "./quiz.service.js";

interface CreateQuestionInput {
  title?: string;
  type?: QuestionType;
}

interface UpdateQuestionInput {
  title?: string;
  description?: string | null;
  type?: QuestionType;
  variableName?: string | null;
  isRequired?: boolean;
  settings?: Record<string, unknown>;
}

interface CreateOptionInput {
  label?: string;
  value?: string;
}

interface UpdateOptionInput {
  label?: string;
  value?: string;
  variableValue?: string | null;
  nextStep?: OptionNextStep;
  nextQuestionId?: string | null;
}

const questionColumns =
  "id,quiz_id,order_index,type,title,description,variable_name,is_required,settings,created_at";
const optionColumns =
  "id,question_id,order_index,label,value,variable_value,next_step,next_question_id,created_at";

export async function listQuestions(
  user: AuthenticatedRequestUser,
  quizId: string,
): Promise<QuizQuestion[]> {
  await findAccessibleQuiz(user, quizId);

  const { data: questions, error } = await supabaseAdmin
    .from("questions")
    .select(questionColumns)
    .eq("quiz_id", quizId)
    .order("order_index")
    .returns<QuestionRow[]>();

  if (error) {
    throw new AppError(`Não foi possível listar as perguntas: ${error.message}`);
  }

  if (questions.length === 0) {
    return [];
  }

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("question_options")
    .select(optionColumns)
    .in(
      "question_id",
      questions.map((question) => question.id),
    )
    .order("order_index")
    .returns<QuestionOptionRow[]>();

  if (optionsError) {
    throw new AppError(`Não foi possível listar as opções: ${optionsError.message}`);
  }

  const optionsByQuestion = new Map<string, QuestionOption[]>();

  options.forEach((option) => {
    const current = optionsByQuestion.get(option.question_id) ?? [];
    current.push(mapOption(option));
    optionsByQuestion.set(option.question_id, current);
  });

  return questions.map((question) =>
    mapQuestion(question, optionsByQuestion.get(question.id) ?? []),
  );
}

export async function createQuestion(
  user: AuthenticatedRequestUser,
  quizId: string,
  input: CreateQuestionInput,
): Promise<QuizQuestion> {
  await findAccessibleQuiz(user, quizId);
  const orderIndex = await getNextOrderIndex("questions", "quiz_id", quizId);
  const { data, error } = await supabaseAdmin
    .from("questions")
    .insert({
      quiz_id: quizId,
      order_index: orderIndex,
      title: input.title?.trim() || `Pergunta ${orderIndex + 1}`,
      type: input.type ?? "multiple_choice",
    })
    .select(questionColumns)
    .single<QuestionRow>();

  if (error) {
    throw new AppError(`Não foi possível criar a pergunta: ${error.message}`);
  }

  return mapQuestion(data, []);
}

export async function updateQuestion(
  user: AuthenticatedRequestUser,
  quizId: string,
  questionId: string,
  input: UpdateQuestionInput,
): Promise<QuizQuestion> {
  const current = await findAccessibleQuestion(user, questionId, quizId);
  const update: Record<string, unknown> = {};

  if (input.title !== undefined) {
    update.title = input.title.trim();
  }
  if (input.description !== undefined) {
    update.description = input.description?.trim() || null;
  }
  if (input.isRequired !== undefined) {
    update.is_required = input.isRequired;
  }
  if (input.settings !== undefined) {
    update.settings = input.settings;
  }

  const variableName =
    input.variableName === undefined
      ? current.variable_name
      : normalizeVariableName(input.variableName);
  const requestedType = input.type ?? current.type;

  if (input.variableName !== undefined) {
    update.variable_name = variableName;
  }

  if (input.type !== undefined || input.variableName !== undefined) {
    update.type = getTypeForVariable(variableName, requestedType);
  }

  const { error } = await supabaseAdmin
    .from("questions")
    .update(update)
    .eq("id", questionId)
    .eq("quiz_id", quizId);

  if (error) {
    throw new AppError(`Não foi possível atualizar a pergunta: ${error.message}`);
  }

  return getQuestion(user, quizId, questionId);
}

export async function deleteQuestion(
  user: AuthenticatedRequestUser,
  quizId: string,
  questionId: string,
): Promise<void> {
  await findAccessibleQuestion(user, questionId, quizId);

  const { error: flowError } = await supabaseAdmin
    .from("question_options")
    .update({ next_step: "default", next_question_id: null })
    .eq("next_question_id", questionId);

  if (flowError) {
    throw new AppError(`Não foi possível ajustar o fluxo: ${flowError.message}`);
  }

  const { error } = await supabaseAdmin
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("quiz_id", quizId);

  if (error) {
    throw new AppError(`Não foi possível excluir a pergunta: ${error.message}`);
  }
}

export async function reorderQuestions(
  user: AuthenticatedRequestUser,
  quizId: string,
  orderedIds: string[],
): Promise<QuizQuestion[]> {
  await findAccessibleQuiz(user, quizId);
  ensureUniqueIds(orderedIds);

  const { error } = await supabaseAdmin.rpc("reorder_quiz_questions", {
    target_quiz_id: quizId,
    ordered_ids: orderedIds,
  });

  if (error) {
    throw new AppError(`Não foi possível reordenar as perguntas: ${error.message}`);
  }

  return listQuestions(user, quizId);
}

export async function createOption(
  user: AuthenticatedRequestUser,
  questionId: string,
  input: CreateOptionInput,
): Promise<QuestionOption> {
  await findAccessibleQuestion(user, questionId);
  const orderIndex = await getNextOrderIndex(
    "question_options",
    "question_id",
    questionId,
  );
  const label = input.label?.trim() || `Opção ${orderIndex + 1}`;
  const { data, error } = await supabaseAdmin
    .from("question_options")
    .insert({
      question_id: questionId,
      order_index: orderIndex,
      label,
      value: input.value?.trim() || slugifyValue(label),
    })
    .select(optionColumns)
    .single<QuestionOptionRow>();

  if (error) {
    throw new AppError(`Não foi possível criar a opção: ${error.message}`);
  }

  return mapOption(data);
}

export async function updateOption(
  user: AuthenticatedRequestUser,
  questionId: string,
  optionId: string,
  input: UpdateOptionInput,
): Promise<QuestionOption> {
  const question = await findAccessibleQuestion(user, questionId);
  await findOption(questionId, optionId);
  const update: Record<string, unknown> = {};

  if (input.label !== undefined) {
    update.label = input.label.trim();
  }
  if (input.value !== undefined) {
    update.value = input.value.trim();
  }
  if (input.variableValue !== undefined) {
    update.variable_value = input.variableValue?.trim() || null;
  }

  if (input.nextStep !== undefined || input.nextQuestionId !== undefined) {
    const nextStep = input.nextStep ?? "default";
    const nextQuestionId =
      nextStep === "question" ? input.nextQuestionId : null;

    if (nextStep === "question") {
      if (!nextQuestionId) {
        throw new AppError("Selecione a pergunta de destino.", 400);
      }
      if (nextQuestionId === questionId) {
        throw new AppError("Uma opção não pode apontar para a própria pergunta.", 400);
      }

      const { data: target, error: targetError } = await supabaseAdmin
        .from("questions")
        .select("id")
        .eq("id", nextQuestionId)
        .eq("quiz_id", question.quiz_id)
        .maybeSingle<{ id: string }>();

      if (targetError) {
        throw new AppError(`Não foi possível validar o destino: ${targetError.message}`);
      }
      if (!target) {
        throw new AppError("A pergunta de destino não pertence a este quiz.", 400);
      }
    }

    update.next_step = nextStep;
    update.next_question_id = nextQuestionId;
  }

  const { data, error } = await supabaseAdmin
    .from("question_options")
    .update(update)
    .eq("id", optionId)
    .eq("question_id", questionId)
    .select(optionColumns)
    .single<QuestionOptionRow>();

  if (error) {
    throw new AppError(`Não foi possível atualizar a opção: ${error.message}`);
  }

  return mapOption(data);
}

export async function deleteOption(
  user: AuthenticatedRequestUser,
  questionId: string,
  optionId: string,
): Promise<void> {
  await findAccessibleQuestion(user, questionId);
  await findOption(questionId, optionId);

  const { error } = await supabaseAdmin
    .from("question_options")
    .delete()
    .eq("id", optionId)
    .eq("question_id", questionId);

  if (error) {
    throw new AppError(`Não foi possível excluir a opção: ${error.message}`);
  }
}

export async function reorderOptions(
  user: AuthenticatedRequestUser,
  questionId: string,
  orderedIds: string[],
): Promise<QuestionOption[]> {
  await findAccessibleQuestion(user, questionId);
  ensureUniqueIds(orderedIds);

  const { error } = await supabaseAdmin.rpc("reorder_question_options", {
    target_question_id: questionId,
    ordered_ids: orderedIds,
  });

  if (error) {
    throw new AppError(`Não foi possível reordenar as opções: ${error.message}`);
  }

  const { data, error: listError } = await supabaseAdmin
    .from("question_options")
    .select(optionColumns)
    .eq("question_id", questionId)
    .order("order_index")
    .returns<QuestionOptionRow[]>();

  if (listError) {
    throw new AppError(`Não foi possível recarregar as opções: ${listError.message}`);
  }

  return data.map(mapOption);
}

async function getQuestion(
  user: AuthenticatedRequestUser,
  quizId: string,
  questionId: string,
): Promise<QuizQuestion> {
  const question = await findAccessibleQuestion(user, questionId, quizId);
  const { data, error } = await supabaseAdmin
    .from("question_options")
    .select(optionColumns)
    .eq("question_id", questionId)
    .order("order_index")
    .returns<QuestionOptionRow[]>();

  if (error) {
    throw new AppError(`Não foi possível carregar as opções: ${error.message}`);
  }

  return mapQuestion(question, data.map(mapOption));
}

async function findAccessibleQuestion(
  user: AuthenticatedRequestUser,
  questionId: string,
  expectedQuizId?: string,
): Promise<QuestionRow> {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select(questionColumns)
    .eq("id", questionId)
    .maybeSingle<QuestionRow>();

  if (error) {
    throw new AppError(`Não foi possível buscar a pergunta: ${error.message}`);
  }
  if (!data || (expectedQuizId && data.quiz_id !== expectedQuizId)) {
    throw new AppError("Pergunta não encontrada.", 404);
  }

  await findAccessibleQuiz(user, data.quiz_id);
  return data;
}

async function findOption(
  questionId: string,
  optionId: string,
): Promise<QuestionOptionRow> {
  const { data, error } = await supabaseAdmin
    .from("question_options")
    .select(optionColumns)
    .eq("id", optionId)
    .eq("question_id", questionId)
    .maybeSingle<QuestionOptionRow>();

  if (error) {
    throw new AppError(`Não foi possível buscar a opção: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Opção não encontrada.", 404);
  }

  return data;
}

async function getNextOrderIndex(
  table: "questions" | "question_options",
  foreignKey: "quiz_id" | "question_id",
  foreignId: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("order_index")
    .eq(foreignKey, foreignId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>();

  if (error) {
    throw new AppError(`Não foi possível calcular a ordem: ${error.message}`);
  }

  return (data?.order_index ?? -1) + 1;
}

function normalizeVariableName(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function getTypeForVariable(
  variableName: string | null,
  requestedType: QuestionType,
): QuestionType {
  if (variableName === "name" || variableName === "email" || variableName === "phone") {
    return variableName;
  }

  return requestedType;
}

function ensureUniqueIds(ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new AppError("A lista de ordenação contém IDs repetidos.", 400);
  }
}

function slugifyValue(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "opcao"
  );
}

function mapQuestion(
  question: QuestionRow,
  options: QuestionOption[],
): QuizQuestion {
  return {
    id: question.id,
    quizId: question.quiz_id,
    orderIndex: question.order_index,
    type: question.type,
    title: question.title,
    description: question.description,
    variableName: question.variable_name,
    isRequired: question.is_required,
    settings: question.settings,
    createdAt: question.created_at,
    options,
  };
}

function mapOption(option: QuestionOptionRow): QuestionOption {
  return {
    id: option.id,
    questionId: option.question_id,
    orderIndex: option.order_index,
    label: option.label,
    value: option.value,
    variableValue: option.variable_value,
    nextStep: option.next_step,
    nextQuestionId: option.next_question_id,
    createdAt: option.created_at,
  };
}
