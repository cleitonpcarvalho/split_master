import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type {
  OptionNextStep,
  QuestionOptionRow,
  QuestionRow,
} from "../models/question.js";
import type {
  PublicAttribution,
  PublicLeadSession,
  PublicQuiz,
  PublicQuizOption,
  PublicQuizQuestion,
  PublicQuizSettings,
} from "../models/public-quiz.js";
import type { QuizRow } from "../models/quiz.js";
import { queueLeadIntegrations } from "./integration-dispatcher.service.js";
import { listPublicFinalPageBlocks } from "./final-page.service.js";
import { getPublicTrackingSettings } from "./pixel.service.js";

interface PublicLeadInput {
  slug: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  answers: Record<string, string>;
  variables: Record<string, string>;
  attribution?: PublicAttribution;
}

interface PublicLeadUpdateInput {
  email?: string;
  name?: string | null;
  phone?: string | null;
  answers: Record<string, string>;
  variables: Record<string, string>;
  attribution?: PublicAttribution;
}

interface PublicRequestContext {
  ip?: string;
  userAgent?: string;
}

interface PublicQuizRow extends QuizRow {
  status: "active";
}

interface LeadAccessRow {
  id: string;
  quiz_id: string;
  public_token: string;
}

const quizColumns =
  "id,user_id,title,slug,subdomain,status,settings,created_at,updated_at";
const questionColumns =
  "id,quiz_id,order_index,type,title,description,variable_name,is_required,settings,created_at";
const optionColumns =
  "id,question_id,order_index,label,value,variable_value,next_step,next_question_id,created_at";

export async function getPublicQuiz(slug: string): Promise<PublicQuiz> {
  const quiz = await findActiveQuizBySlug(slug);
  const [questions, finalPageBlocks, tracking] = await Promise.all([
    getPublicQuestions(quiz.id),
    listPublicFinalPageBlocks(quiz.id),
    getPublicTrackingSettings(quiz.id),
  ]);

  return {
    id: quiz.id,
    title: quiz.title,
    slug: quiz.slug,
    settings: sanitizePublicSettings(quiz.settings),
    questions,
    finalPageBlocks,
    tracking,
  };
}

export async function registerPublicVisit(
  slug: string,
  attribution: PublicAttribution,
  context: PublicRequestContext,
): Promise<void> {
  const quiz = await findActiveQuizBySlug(slug);
  const { error } = await supabaseAdmin.from("analytics_events").insert({
    quiz_id: quiz.id,
    event_type: "visit",
    metadata: {
      attribution,
      ip: context.ip,
      userAgent: context.userAgent,
    },
  });

  if (error) {
    throw new AppError(`Não foi possível registrar a visita: ${error.message}`);
  }
}

export async function createOrResumePublicLead(
  input: PublicLeadInput,
): Promise<PublicLeadSession> {
  const quiz = await findActiveQuizBySlug(input.slug);
  const email = normalizeEmail(input.email);
  assertAllowedEmail(email);
  const sanitized = await sanitizeLeadData(
    quiz.id,
    input.answers,
    input.variables,
  );
  const existing = await findLeadByEmail(quiz.id, email);
  const payload = {
    email,
    name: normalizeOptional(input.name ?? sanitized.variables.name),
    phone: normalizeOptional(input.phone ?? sanitized.variables.phone),
    answers: sanitized.answers,
    variables: sanitized.variables,
    ...mapAttribution(input.attribution),
  };

  if (existing) {
    const { error } = await supabaseAdmin
      .from("leads")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new AppError(`Não foi possível atualizar o lead: ${error.message}`);
    }

    queueLeadIntegrations(existing.id, "lead.updated");

    return {
      id: existing.id,
      writeToken: existing.public_token,
      existing: true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      quiz_id: quiz.id,
      ...payload,
    })
    .select("id,public_token")
    .single<{ id: string; public_token: string }>();

  if (error) {
    throw new AppError(`Não foi possível salvar o lead: ${error.message}`);
  }

  queueLeadIntegrations(data.id, "lead.created");

  return {
    id: data.id,
    writeToken: data.public_token,
    existing: false,
  };
}

export async function updatePublicLead(
  id: string,
  writeToken: string,
  input: PublicLeadUpdateInput,
): Promise<void> {
  const lead = await findLeadForWrite(id, writeToken);
  await findActiveQuizById(lead.quiz_id);
  const sanitized = await sanitizeLeadData(
    lead.quiz_id,
    input.answers,
    input.variables,
  );
  const email = input.email ? normalizeEmail(input.email) : undefined;

  if (email) {
    assertAllowedEmail(email);
  }

  const { error } = await supabaseAdmin
    .from("leads")
    .update({
      ...(email ? { email } : {}),
      name: normalizeOptional(input.name ?? sanitized.variables.name),
      phone: normalizeOptional(input.phone ?? sanitized.variables.phone),
      answers: sanitized.answers,
      variables: sanitized.variables,
      ...mapAttribution(input.attribution),
    })
    .eq("id", lead.id);

  if (error) {
    throw new AppError(`Não foi possível atualizar o lead: ${error.message}`);
  }

  queueLeadIntegrations(lead.id, "lead.updated");
}

export async function registerPublicLeadEvent(
  id: string,
  writeToken: string,
  eventType: "start" | "complete" | "cta_click" | "checkout_click",
  metadata: Record<string, unknown>,
  context: PublicRequestContext,
): Promise<void> {
  const lead = await findLeadForWrite(id, writeToken);
  await findActiveQuizById(lead.quiz_id);

  const { error } = await supabaseAdmin.from("analytics_events").insert({
    quiz_id: lead.quiz_id,
    lead_id: lead.id,
    event_type: eventType,
    metadata: {
      ...metadata,
      ip: context.ip,
      userAgent: context.userAgent,
    },
  });

  if (error) {
    throw new AppError(`Não foi possível registrar o evento: ${error.message}`);
  }

  const leadUpdate: Record<string, unknown> = {};

  if (eventType === "complete") {
    leadUpdate.completed = true;
    leadUpdate.completed_at = new Date().toISOString();
  }
  if (eventType === "cta_click") {
    leadUpdate.cta_clicked = true;
  }
  if (eventType === "checkout_click") {
    leadUpdate.checkout_clicked = true;
  }

  if (Object.keys(leadUpdate).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update(leadUpdate)
      .eq("id", lead.id);

    if (updateError) {
      throw new AppError(
        `Não foi possível atualizar o progresso: ${updateError.message}`,
      );
    }

    queueLeadIntegrations(lead.id, "lead.updated");
  }
}

async function findActiveQuizBySlug(slug: string): Promise<PublicQuizRow> {
  const { data, error } = await supabaseAdmin
    .from("quizzes")
    .select(quizColumns)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<PublicQuizRow>();

  if (error) {
    throw new AppError(`Não foi possível carregar o quiz: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Quiz não encontrado ou indisponível.", 404);
  }

  return data;
}

async function findActiveQuizById(id: string): Promise<PublicQuizRow> {
  const { data, error } = await supabaseAdmin
    .from("quizzes")
    .select(quizColumns)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle<PublicQuizRow>();

  if (error) {
    throw new AppError(`Não foi possível carregar o quiz: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Quiz não encontrado ou indisponível.", 404);
  }

  return data;
}

async function getPublicQuestions(
  quizId: string,
): Promise<PublicQuizQuestion[]> {
  const { data: questions, error } = await supabaseAdmin
    .from("questions")
    .select(questionColumns)
    .eq("quiz_id", quizId)
    .order("order_index")
    .returns<QuestionRow[]>();

  if (error) {
    throw new AppError(`Não foi possível carregar as perguntas: ${error.message}`);
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
    throw new AppError(`Não foi possível carregar as opções: ${optionsError.message}`);
  }

  return questions.map((question) => ({
    id: question.id,
    orderIndex: question.order_index,
    type: question.type,
    title: question.title,
    description: question.description,
    variableName: question.variable_name,
    isRequired: question.is_required,
    options: options
      .filter((option) => option.question_id === question.id)
      .map(mapPublicOption),
  }));
}

async function sanitizeLeadData(
  quizId: string,
  answers: Record<string, string>,
  variables: Record<string, string>,
): Promise<{
  answers: Record<string, string>;
  variables: Record<string, string>;
}> {
  const questions = await getPublicQuestions(quizId);
  const questionIds = new Set(questions.map((question) => question.id));
  const variableNames = new Set(
    questions
      .flatMap((question) => [
        question.variableName,
        question.type === "name" ||
        question.type === "email" ||
        question.type === "phone"
          ? question.type
          : null,
      ])
      .filter((value): value is string => Boolean(value)),
  );

  return {
    answers: Object.fromEntries(
      Object.entries(answers).filter(([id]) => questionIds.has(id)),
    ),
    variables: Object.fromEntries(
      Object.entries(variables).filter(([name]) => variableNames.has(name)),
    ),
  };
}

async function findLeadByEmail(
  quizId: string,
  email: string,
): Promise<LeadAccessRow | null> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id,quiz_id,public_token")
    .eq("quiz_id", quizId)
    .eq("email", email)
    .order("created_at")
    .limit(1)
    .maybeSingle<LeadAccessRow>();

  if (error) {
    throw new AppError(`Não foi possível consultar o lead: ${error.message}`);
  }

  return data;
}

async function findLeadForWrite(
  id: string,
  writeToken: string,
): Promise<LeadAccessRow> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id,quiz_id,public_token")
    .eq("id", id)
    .eq("public_token", writeToken)
    .maybeSingle<LeadAccessRow>();

  if (error) {
    throw new AppError(`Não foi possível consultar o lead: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Lead não encontrado ou token inválido.", 404);
  }

  return data;
}

function sanitizePublicSettings(
  settings: Record<string, unknown>,
): PublicQuizSettings {
  return {
    primaryColor: getColor(settings.primaryColor, "#00C48C"),
    backgroundColor: getColor(settings.backgroundColor, "#FFFFFF"),
    logoUrl: getHttpUrl(settings.logoUrl),
    ctaText: getString(settings.cta_text, "Continuar"),
    ctaUrl: getHttpUrl(settings.cta_url),
    finalPageTitle: getString(
      settings.final_page_title,
      "Olá {{name}}, obrigado por responder!",
    ),
    finalPageMessage: getString(
      settings.final_page_message,
      "Recebemos suas respostas e em breve você poderá seguir para o próximo passo.",
    ),
  };
}

function mapPublicOption(option: QuestionOptionRow): PublicQuizOption {
  return {
    id: option.id,
    label: option.label,
    value: option.value,
    variableValue: option.variable_value,
    nextStep: option.next_step as OptionNextStep,
    nextQuestionId: option.next_question_id,
  };
}

function mapAttribution(attribution?: PublicAttribution) {
  return {
    utm_source: normalizeOptional(attribution?.utmSource),
    utm_medium: normalizeOptional(attribution?.utmMedium),
    utm_campaign: normalizeOptional(attribution?.utmCampaign),
    utm_content: normalizeOptional(attribution?.utmContent),
    utm_term: normalizeOptional(attribution?.utmTerm),
    fbclid: normalizeOptional(attribution?.fbclid),
    gclid: normalizeOptional(attribution?.gclid),
  };
}

function assertAllowedEmail(email: string): void {
  const blocked = new Set([
    "a@a.com",
    "email@email.com",
    "foo@bar.com",
    "test@test.com",
    "teste@teste.com",
  ]);

  if (blocked.has(email)) {
    throw new AppError("Informe um e-mail válido para continuar.", 400);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptional(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function getHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
