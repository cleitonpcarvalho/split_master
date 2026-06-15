import { supabaseAdmin } from "../config/supabase.js";
import type {
  AnalyticsAnswerDistribution,
  AnalyticsFilters,
  AnalyticsFunnelStep,
  AnalyticsPeriod,
  AnalyticsQuizSummary,
  AnalyticsSummary,
  AnalyticsSummaryTotals,
  AnalyticsTimelinePoint,
  AnalyticsUtmDistribution,
} from "../models/analytics.js";
import { AppError } from "../models/app-error.js";
import type { QuizRow } from "../models/quiz.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import { findAccessibleQuiz } from "./quiz.service.js";

interface RpcSummaryRow {
  quiz_id: string;
  quiz_name: string;
  visitors: number | string;
  starts: number | string;
  completions: number | string;
  leads: number | string;
  cta_clicks: number | string;
  checkout_clicks: number | string;
}

interface RpcTimelineRow {
  day: string;
  visitors: number | string;
  starts: number | string;
  completions: number | string;
  leads: number | string;
  checkout_clicks: number | string;
}

interface RpcFunnelRow {
  step_key: string;
  label: string;
  order_index: number;
  count: number | string;
}

interface RpcAnswerDistributionRow {
  question_id: string;
  question_title: string;
  option_label: string;
  option_value: string;
  count: number | string;
  total: number | string;
}

interface RpcUtmRow {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  visitors: number | string;
  leads: number | string;
  conversions: number | string;
}

export async function getAnalyticsSummary(
  user: AuthenticatedRequestUser,
  filters: AnalyticsFilters,
): Promise<AnalyticsSummary> {
  const quizzes = await getAccessibleQuizzes(user, filters.quizId);
  const period = mapPeriod(filters);

  if (quizzes.length === 0) {
    return {
      period,
      totals: emptyTotals(),
      quizzes: [],
    };
  }

  const rows = await callSummaryRpc(quizzes, filters);
  const quizSummaries = rows.map(mapSummaryRow);

  return {
    period,
    totals: sumTotals(quizSummaries),
    quizzes: quizSummaries,
  };
}

export async function getAnalyticsTimeline(
  user: AuthenticatedRequestUser,
  filters: AnalyticsFilters,
): Promise<AnalyticsTimelinePoint[]> {
  const quizzes = await getAccessibleQuizzes(user, filters.quizId);

  if (quizzes.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin.rpc("analytics_timeline", {
    target_quiz_ids: quizzes.map((quiz) => quiz.id),
    start_at: filters.startDate,
    end_at: filters.endDate,
  });

  if (error) {
    throw new AppError(
      `Não foi possível carregar a linha do tempo: ${error.message}`,
    );
  }

  return ((data ?? []) as RpcTimelineRow[]).map((row) => ({
    date: row.day,
    visitors: toNumber(row.visitors),
    starts: toNumber(row.starts),
    completions: toNumber(row.completions),
    leads: toNumber(row.leads),
    checkoutClicks: toNumber(row.checkout_clicks),
  }));
}

export async function getQuizAnalyticsSummary(
  user: AuthenticatedRequestUser,
  quizId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsQuizSummary> {
  const quiz = await findAccessibleQuiz(user, quizId);
  const rows = await callSummaryRpc([quiz], { ...filters, quizId });
  const summary = rows[0] ? mapSummaryRow(rows[0]) : null;

  return summary ?? {
    quizId: quiz.id,
    quizName: quiz.title,
    ...emptyTotals(),
  };
}

export async function getQuizAnalyticsTimeline(
  user: AuthenticatedRequestUser,
  quizId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsTimelinePoint[]> {
  await findAccessibleQuiz(user, quizId);
  return getAnalyticsTimeline(user, { ...filters, quizId });
}

export async function getQuizAnalyticsFunnel(
  user: AuthenticatedRequestUser,
  quizId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsFunnelStep[]> {
  await findAccessibleQuiz(user, quizId);
  const { data, error } = await supabaseAdmin.rpc("analytics_funnel", {
    target_quiz_id: quizId,
    start_at: filters.startDate,
    end_at: filters.endDate,
  });

  if (error) {
    throw new AppError(`Não foi possível carregar o funil: ${error.message}`);
  }

  return ((data ?? []) as RpcFunnelRow[]).map((row) => ({
    key: row.step_key,
    label: row.label,
    orderIndex: row.order_index,
    count: toNumber(row.count),
  }));
}

export async function getQuizAnswerDistribution(
  user: AuthenticatedRequestUser,
  quizId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsAnswerDistribution[]> {
  await findAccessibleQuiz(user, quizId);
  const { data, error } = await supabaseAdmin.rpc(
    "analytics_answer_distribution",
    {
      target_quiz_id: quizId,
      start_at: filters.startDate,
      end_at: filters.endDate,
    },
  );

  if (error) {
    throw new AppError(
      `Não foi possível carregar as respostas: ${error.message}`,
    );
  }

  const byQuestion = new Map<string, AnalyticsAnswerDistribution>();

  for (const row of (data ?? []) as RpcAnswerDistributionRow[]) {
    const total = toNumber(row.total);
    const current = byQuestion.get(row.question_id) ?? {
      questionId: row.question_id,
      questionTitle: row.question_title,
      total,
      options: [],
    };
    const count = toNumber(row.count);

    current.total = total;
    current.options.push({
      label: row.option_label,
      value: row.option_value,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    });
    byQuestion.set(row.question_id, current);
  }

  return Array.from(byQuestion.values());
}

export async function getQuizUtmDistribution(
  user: AuthenticatedRequestUser,
  quizId: string,
  filters: AnalyticsFilters,
): Promise<AnalyticsUtmDistribution[]> {
  await findAccessibleQuiz(user, quizId);
  const { data, error } = await supabaseAdmin.rpc("analytics_utm_distribution", {
    target_quiz_id: quizId,
    start_at: filters.startDate,
    end_at: filters.endDate,
  });

  if (error) {
    throw new AppError(`Não foi possível carregar as UTMs: ${error.message}`);
  }

  return ((data ?? []) as RpcUtmRow[]).map((row) => {
    const visitors = toNumber(row.visitors);
    const conversions = toNumber(row.conversions);

    return {
      source: row.utm_source,
      medium: row.utm_medium,
      campaign: row.utm_campaign,
      visitors,
      leads: toNumber(row.leads),
      conversions,
      conversionRate:
        visitors === 0 ? 0 : Math.round((conversions / visitors) * 100),
    };
  });
}

async function getAccessibleQuizzes(
  user: AuthenticatedRequestUser,
  quizId?: string,
): Promise<QuizRow[]> {
  if (quizId) {
    return [await findAccessibleQuiz(user, quizId)];
  }

  let query = supabaseAdmin
    .from("quizzes")
    .select("id,user_id,title,slug,subdomain,status,settings,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (user.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.returns<QuizRow[]>();

  if (error) {
    throw new AppError(`Não foi possível carregar os quizzes: ${error.message}`);
  }

  return data;
}

async function callSummaryRpc(
  quizzes: QuizRow[],
  filters: AnalyticsFilters,
): Promise<RpcSummaryRow[]> {
  const { data, error } = await supabaseAdmin.rpc("analytics_summary_by_quiz", {
    target_quiz_ids: quizzes.map((quiz) => quiz.id),
    start_at: filters.startDate,
    end_at: filters.endDate,
  });

  if (error) {
    throw new AppError(`Não foi possível carregar o resumo: ${error.message}`);
  }

  return (data ?? []) as RpcSummaryRow[];
}

function mapSummaryRow(row: RpcSummaryRow): AnalyticsQuizSummary {
  const starts = toNumber(row.starts);
  const completions = toNumber(row.completions);

  return {
    quizId: row.quiz_id,
    quizName: row.quiz_name,
    visitors: toNumber(row.visitors),
    starts,
    completions,
    completionRate: starts === 0 ? 0 : Math.round((completions / starts) * 100),
    leads: toNumber(row.leads),
    ctaClicks: toNumber(row.cta_clicks),
    checkoutClicks: toNumber(row.checkout_clicks),
  };
}

function sumTotals(rows: AnalyticsQuizSummary[]): AnalyticsSummaryTotals {
  const totals = rows.reduce(
    (accumulator, row) => ({
      visitors: accumulator.visitors + row.visitors,
      starts: accumulator.starts + row.starts,
      completions: accumulator.completions + row.completions,
      leads: accumulator.leads + row.leads,
      ctaClicks: accumulator.ctaClicks + row.ctaClicks,
      checkoutClicks: accumulator.checkoutClicks + row.checkoutClicks,
    }),
    {
      visitors: 0,
      starts: 0,
      completions: 0,
      leads: 0,
      ctaClicks: 0,
      checkoutClicks: 0,
    },
  );

  return {
    ...totals,
    completionRate:
      totals.starts === 0
        ? 0
        : Math.round((totals.completions / totals.starts) * 100),
  };
}

function emptyTotals(): AnalyticsSummaryTotals {
  return {
    visitors: 0,
    starts: 0,
    completions: 0,
    completionRate: 0,
    leads: 0,
    ctaClicks: 0,
    checkoutClicks: 0,
  };
}

function mapPeriod(filters: AnalyticsFilters): AnalyticsPeriod {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}
