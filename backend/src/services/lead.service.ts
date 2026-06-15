import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type {
  LeadAnswerDetail,
  LeadDetail,
  LeadEvent,
  LeadListResponse,
  LeadSummary,
} from "../models/lead.js";
import type { AuthenticatedRequestUser } from "../models/user.js";

interface LeadWithQuiz {
  id: string;
  quiz_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  answers: Record<string, unknown>;
  variables: Record<string, unknown>;
  tags: string[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  completed: boolean;
  cta_clicked: boolean;
  checkout_clicked: boolean;
  created_at: string;
  updated_at: string;
  quiz: {
    id: string;
    title: string;
    user_id: string;
  };
}

interface LeadFilters {
  quizId?: string;
  startDate?: string;
  endDate?: string;
  completed?: boolean;
  hasEmail?: boolean;
  page?: number;
  perPage?: number;
}

interface FetchLeadFilters extends LeadFilters {
  limit?: number;
}

interface QuestionForLead {
  id: string;
  title: string;
  type: string;
  order_index: number;
}

interface OptionForLead {
  id: string;
  question_id: string;
  label: string;
  value: string;
}

interface AnalyticsEventRow {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const leadColumns =
  "id,quiz_id,name,email,phone,answers,variables,tags,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,gclid,completed,cta_clicked,checkout_clicked,created_at,updated_at,quiz:quizzes!inner(id,title,user_id)";

export async function listLeads(
  user: AuthenticatedRequestUser,
  quizId?: string,
  limit?: number,
): Promise<LeadSummary[]> {
  const leads = await fetchLeads(user, { quizId, limit });

  return leads.map(mapLeadSummary);
}

export async function listLeadsPage(
  user: AuthenticatedRequestUser,
  filters: LeadFilters = {},
): Promise<LeadListResponse> {
  const page = Math.max(filters.page ?? 1, 1);
  const perPage = Math.min(Math.max(filters.perPage ?? 20, 1), 100);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let query = supabaseAdmin
    .from("leads")
    .select(leadColumns, { count: "exact" })
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.eq("quiz.user_id", user.id);
  }
  if (filters.quizId) {
    query = query.eq("quiz_id", filters.quizId);
  }
  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lt("created_at", filters.endDate);
  }
  if (filters.completed !== undefined) {
    query = query.eq("completed", filters.completed);
  }
  if (filters.hasEmail) {
    query = query.not("email", "is", null).neq("email", "");
  }

  const { data, count, error } = await query
    .range(from, to)
    .returns<LeadWithQuiz[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os leads: ${error.message}`);
  }

  return {
    data: data.map(mapLeadSummary),
    pagination: {
      page,
      perPage,
      total: count ?? 0,
      totalPages: Math.max(Math.ceil((count ?? 0) / perPage), 1),
    },
  };
}

export async function getLead(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<LeadDetail> {
  let query = supabaseAdmin.from("leads").select(leadColumns).eq("id", id);

  if (user.role !== "admin") {
    query = query.eq("quiz.user_id", user.id);
  }

  const { data, error } = await query.maybeSingle<LeadWithQuiz>();

  if (error) {
    throw new AppError(`Não foi possível carregar o lead: ${error.message}`);
  }

  if (!data) {
    throw new AppError("Lead não encontrado.", 404);
  }

  const [answerDetails, events] = await Promise.all([
    buildAnswerDetails(data),
    listLeadEvents(data),
  ]);

  return {
    ...mapLeadSummary(data),
    answers: data.answers,
    answerDetails,
    variables: data.variables,
    tags: data.tags,
    attribution: {
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmContent: data.utm_content,
      utmTerm: data.utm_term,
      fbclid: data.fbclid,
      gclid: data.gclid,
    },
    events,
    updatedAt: data.updated_at,
  };
}

export async function exportLeadsCsv(
  user: AuthenticatedRequestUser,
  filters: LeadFilters = {},
): Promise<string> {
  const leads = await fetchLeads(user, filters);
  const variableKeys = Array.from(
    new Set(leads.flatMap((lead) => Object.keys(lead.variables ?? {}))),
  ).sort((first, second) => first.localeCompare(second));
  const header = [
    "id",
    "name",
    "email",
    "phone",
    "quiz_name",
    "completed",
    "cta_clicked",
    "checkout_clicked",
    ...variableKeys,
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "gclid",
    "created_at",
    "updated_at",
  ];
  const rows = leads.map((lead) => [
    lead.id,
    lead.name ?? "",
    lead.email ?? "",
    lead.phone ?? "",
    lead.quiz.title,
    lead.completed ? "Sim" : "Não",
    lead.cta_clicked ? "Sim" : "Não",
    lead.checkout_clicked ? "Sim" : "Não",
    ...variableKeys.map((key) => renderCsvValue(lead.variables?.[key])),
    lead.utm_source ?? "",
    lead.utm_medium ?? "",
    lead.utm_campaign ?? "",
    lead.utm_content ?? "",
    lead.utm_term ?? "",
    lead.fbclid ?? "",
    lead.gclid ?? "",
    lead.created_at,
    lead.updated_at,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

function mapLeadSummary(lead: LeadWithQuiz): LeadSummary {
  return {
    id: lead.id,
    quizId: lead.quiz_id,
    quizTitle: lead.quiz.title,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    completed: lead.completed,
    ctaClicked: lead.cta_clicked,
    checkoutClicked: lead.checkout_clicked,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  };
}

async function fetchLeads(
  user: AuthenticatedRequestUser,
  filters: FetchLeadFilters = {},
): Promise<LeadWithQuiz[]> {
  let query = supabaseAdmin
    .from("leads")
    .select(leadColumns)
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.eq("quiz.user_id", user.id);
  }
  if (filters.quizId) {
    query = query.eq("quiz_id", filters.quizId);
  }
  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lt("created_at", filters.endDate);
  }
  if (filters.completed !== undefined) {
    query = query.eq("completed", filters.completed);
  }
  if (filters.hasEmail) {
    query = query.not("email", "is", null).neq("email", "");
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query.returns<LeadWithQuiz[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os leads: ${error.message}`);
  }

  return data;
}

async function buildAnswerDetails(
  lead: LeadWithQuiz,
): Promise<LeadAnswerDetail[]> {
  const questionIds = Object.keys(lead.answers ?? {});

  if (questionIds.length === 0) {
    return [];
  }

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("questions")
    .select("id,title,type,order_index")
    .eq("quiz_id", lead.quiz_id)
    .in("id", questionIds)
    .order("order_index")
    .returns<QuestionForLead[]>();

  if (questionsError) {
    throw new AppError(
      `Não foi possível carregar as perguntas do lead: ${questionsError.message}`,
    );
  }

  const { data: options, error: optionsError } = await supabaseAdmin
    .from("question_options")
    .select("id,question_id,label,value")
    .in("question_id", questionIds)
    .returns<OptionForLead[]>();

  if (optionsError) {
    throw new AppError(
      `Não foi possível carregar as opções do lead: ${optionsError.message}`,
    );
  }

  const optionsByQuestion = new Map<string, OptionForLead[]>();

  for (const option of options) {
    optionsByQuestion.set(option.question_id, [
      ...(optionsByQuestion.get(option.question_id) ?? []),
      option,
    ]);
  }

  const knownQuestionIds = new Set(questions.map((question) => question.id));
  const details = questions.map((question) => {
    const answer = lead.answers[question.id];
    const option = optionsByQuestion
      .get(question.id)
      ?.find((item) => item.value === String(answer));

    return {
      questionId: question.id,
      questionTitle: question.title,
      answer,
      answerLabel: option?.label ?? renderCsvValue(answer),
    };
  });

  for (const [questionId, answer] of Object.entries(lead.answers)) {
    if (!knownQuestionIds.has(questionId)) {
      details.push({
        questionId,
        questionTitle: questionId,
        answer,
        answerLabel: renderCsvValue(answer),
      });
    }
  }

  return details;
}

async function listLeadEvents(lead: LeadWithQuiz): Promise<LeadEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("id,event_type,metadata,created_at")
    .eq("lead_id", lead.id)
    .order("created_at")
    .returns<AnalyticsEventRow[]>();

  if (error) {
    throw new AppError(
      `Não foi possível carregar a timeline do lead: ${error.message}`,
    );
  }

  const events = data.map(mapLeadEvent);

  if (!events.some((event) => event.type === "visit")) {
    events.unshift({
      id: `${lead.id}-visit`,
      type: "visit",
      label: "Visitou",
      createdAt: lead.created_at,
      metadata: { inferred: true },
    });
  }

  return events;
}

function mapLeadEvent(event: AnalyticsEventRow): LeadEvent {
  return {
    id: event.id,
    type: event.event_type,
    label: eventLabels[event.event_type] ?? event.event_type,
    createdAt: event.created_at,
    metadata: event.metadata,
  };
}

const eventLabels: Record<string, string> = {
  visit: "Visitou",
  start: "Iniciou",
  complete: "Concluiu",
  cta_click: "Clicou no CTA",
  checkout_click: "Clicou no checkout",
};

function renderCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function escapeCsvValue(value: unknown): string {
  return `"${renderCsvValue(value).replace(/"/g, '""')}"`;
}
