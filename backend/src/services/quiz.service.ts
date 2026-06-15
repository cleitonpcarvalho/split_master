import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import {
  type QuizRow,
  type QuizStatus,
  type QuizSummary,
} from "../models/quiz.js";

interface QuizWithCount extends QuizRow {
  leads: Array<{ count: number }>;
}

interface CreateQuizInput {
  title: string;
  settings?: Record<string, unknown>;
}

interface UpdateQuizInput {
  title?: string;
  slug?: string;
  status?: QuizStatus;
  settings?: Record<string, unknown>;
  subdomain?: string | null;
}

interface QuestionRow {
  id: string;
  quiz_id: string;
  order_index: number;
  type: string;
  title: string;
  description: string | null;
  variable_name: string | null;
  is_required: boolean;
  settings: Record<string, unknown>;
}

interface QuestionOptionRow {
  id: string;
  question_id: string;
  order_index: number;
  label: string;
  value: string;
  variable_value: string | null;
  next_step: "default" | "question" | "final";
  next_question_id: string | null;
}

const quizColumns =
  "id,user_id,title,slug,subdomain,status,settings,created_at,updated_at";

export async function listQuizzes(
  user: AuthenticatedRequestUser,
  filters: { status?: QuizStatus; userId?: string } = {},
): Promise<QuizSummary[]> {
  let query = supabaseAdmin
    .from("quizzes")
    .select(`${quizColumns},leads(count)`)
    .order("created_at", { ascending: false });

  const ownerId = user.role === "admin" ? filters.userId : user.id;

  if (ownerId) {
    query = query.eq("user_id", ownerId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.returns<QuizWithCount[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os quizzes: ${error.message}`);
  }

  return data.map(mapQuizSummary);
}

export async function createQuiz(
  user: AuthenticatedRequestUser,
  input: CreateQuizInput,
): Promise<QuizSummary> {
  const title = input.title.trim();
  const slug = await generateUniqueSlug(title);
  const { data, error } = await supabaseAdmin
    .from("quizzes")
    .insert({
      user_id: user.id,
      title,
      slug,
      settings: input.settings ?? {},
    })
    .select(`${quizColumns},leads(count)`)
    .single<QuizWithCount>();

  if (error) {
    throw new AppError(`Não foi possível criar o quiz: ${error.message}`);
  }

  return mapQuizSummary(data);
}

export async function getQuiz(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<QuizSummary> {
  const quiz = await findAccessibleQuiz(user, id);
  const { count, error } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", id);

  if (error) {
    throw new AppError(
      `Não foi possível contar os leads do quiz: ${error.message}`,
    );
  }

  return mapQuizSummary({
    ...quiz,
    leads: [{ count: count ?? 0 }],
  });
}

export async function updateQuiz(
  user: AuthenticatedRequestUser,
  id: string,
  input: UpdateQuizInput,
): Promise<QuizSummary> {
  await findAccessibleQuiz(user, id);

  const update: Record<string, unknown> = {};

  if (input.title !== undefined) {
    update.title = input.title.trim();
  }
  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();

    if (await slugExists(slug, id)) {
      throw new AppError("Este slug já está em uso.", 409);
    }

    update.slug = slug;
  }
  if (input.status !== undefined) {
    update.status = input.status;
  }
  if (input.settings !== undefined) {
    update.settings = input.settings;
  }
  if (input.subdomain !== undefined) {
    update.subdomain = input.subdomain;
  }

  const { error } = await supabaseAdmin
    .from("quizzes")
    .update(update)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new AppError("Este slug ou subdomínio já está em uso.", 409);
    }

    throw new AppError(`Não foi possível atualizar o quiz: ${error.message}`);
  }

  return getQuiz(user, id);
}

export async function deleteQuiz(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<void> {
  await findAccessibleQuiz(user, id);

  const { error } = await supabaseAdmin.from("quizzes").delete().eq("id", id);

  if (error) {
    throw new AppError(`Não foi possível excluir o quiz: ${error.message}`);
  }
}

export async function duplicateQuiz(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<QuizSummary> {
  const source = await findAccessibleQuiz(user, id);
  const copyTitle = `Cópia de ${source.title}`;
  const copySlug = await generateUniqueSlug(copyTitle);
  const { data: copy, error: copyError } = await supabaseAdmin
    .from("quizzes")
    .insert({
      user_id: source.user_id,
      title: copyTitle,
      slug: copySlug,
      status: "draft",
      settings: source.settings,
    })
    .select(quizColumns)
    .single<QuizRow>();

  if (copyError) {
    throw new AppError(`Não foi possível duplicar o quiz: ${copyError.message}`);
  }

  try {
    await duplicateQuestions(source.id, copy.id);
  } catch (error) {
    await supabaseAdmin.from("quizzes").delete().eq("id", copy.id);
    throw error;
  }

  return getQuiz(user, copy.id);
}

export async function findAccessibleQuiz(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<QuizRow> {
  let query = supabaseAdmin.from("quizzes").select(quizColumns).eq("id", id);

  if (user.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.maybeSingle<QuizRow>();

  if (error) {
    throw new AppError(`Não foi possível buscar o quiz: ${error.message}`);
  }

  if (!data) {
    throw new AppError("Quiz não encontrado.", 404);
  }

  return data;
}

async function duplicateQuestions(
  sourceQuizId: string,
  targetQuizId: string,
): Promise<void> {
  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("questions")
    .select(
      "id,quiz_id,order_index,type,title,description,variable_name,is_required,settings",
    )
    .eq("quiz_id", sourceQuizId)
    .order("order_index")
    .returns<QuestionRow[]>();

  if (questionsError) {
    throw new AppError(
      `Não foi possível carregar as perguntas: ${questionsError.message}`,
    );
  }

  if (questions.length === 0) {
    return;
  }

  const { data: copiedQuestions, error: insertQuestionsError } =
    await supabaseAdmin
      .from("questions")
      .insert(
        questions.map((question) => ({
          quiz_id: targetQuizId,
          order_index: question.order_index,
          type: question.type,
          title: question.title,
          description: question.description,
          variable_name: question.variable_name,
          is_required: question.is_required,
          settings: question.settings,
        })),
      )
      .select("id,order_index")
      .returns<Array<{ id: string; order_index: number }>>();

  if (insertQuestionsError) {
    throw new AppError(
      `Não foi possível copiar as perguntas: ${insertQuestionsError.message}`,
    );
  }

  const copiedByOrder = new Map(
    copiedQuestions.map((question) => [question.order_index, question.id]),
  );
  const newQuestionIds = new Map(
    questions.map((question) => [
      question.id,
      copiedByOrder.get(question.order_index) as string,
    ]),
  );
  const sourceQuestionIds = questions.map((question) => question.id);
  const { data: options, error: optionsError } = await supabaseAdmin
    .from("question_options")
    .select(
      "id,question_id,order_index,label,value,variable_value,next_step,next_question_id",
    )
    .in("question_id", sourceQuestionIds)
    .returns<QuestionOptionRow[]>();

  if (optionsError) {
    throw new AppError(
      `Não foi possível carregar as opções: ${optionsError.message}`,
    );
  }

  if (options.length === 0) {
    return;
  }

  const { error: insertOptionsError } = await supabaseAdmin
    .from("question_options")
    .insert(
      options.map((option) => ({
        question_id: newQuestionIds.get(option.question_id),
        order_index: option.order_index,
        label: option.label,
        value: option.value,
        variable_value: option.variable_value,
        next_step: option.next_step,
        next_question_id: option.next_question_id
          ? newQuestionIds.get(option.next_question_id)
          : null,
      })),
    );

  if (insertOptionsError) {
    throw new AppError(
      `Não foi possível copiar as opções: ${insertOptionsError.message}`,
    );
  }
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "quiz";
  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function slugExists(slug: string, ignoredId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from("quizzes")
    .select("id")
    .eq("slug", slug)
    .limit(1);

  if (ignoredId) {
    query = query.neq("id", ignoredId);
  }

  const { data, error } = await query.maybeSingle<{ id: string }>();

  if (error) {
    throw new AppError(`Não foi possível gerar o slug: ${error.message}`);
  }

  return Boolean(data);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapQuizSummary(quiz: QuizWithCount): QuizSummary {
  return {
    id: quiz.id,
    userId: quiz.user_id,
    title: quiz.title,
    slug: quiz.slug,
    subdomain: quiz.subdomain,
    status: quiz.status,
    settings: quiz.settings,
    leadsCount: quiz.leads[0]?.count ?? 0,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at,
  };
}
