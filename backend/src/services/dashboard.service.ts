import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import { listLeads } from "./lead.service.js";
import { listQuizzes } from "./quiz.service.js";

export interface ClientDashboardData {
  role: "client";
  summary: {
    quizzes: number;
    leads: number;
    completionRate: number;
    checkoutClicks: number;
  };
  recentQuizzes: Awaited<ReturnType<typeof listQuizzes>>;
  recentLeads: Awaited<ReturnType<typeof listLeads>>;
}

export interface AdminDashboardData {
  role: "admin";
  summary: {
    users: number;
    activeUsers: number;
    quizzes: number;
    leads: number;
  };
  recentQuizzes: Awaited<ReturnType<typeof listQuizzes>>;
}

export async function getDashboard(
  user: AuthenticatedRequestUser,
): Promise<ClientDashboardData | AdminDashboardData> {
  if (user.role === "admin") {
    return getAdminDashboard(user);
  }

  return getClientDashboard(user);
}

async function getClientDashboard(
  user: AuthenticatedRequestUser,
): Promise<ClientDashboardData> {
  const quizzes = await listQuizzes(user);
  const quizIds = quizzes.map((quiz) => quiz.id);

  if (quizIds.length === 0) {
    return {
      role: "client",
      summary: {
        quizzes: 0,
        leads: 0,
        completionRate: 0,
        checkoutClicks: 0,
      },
      recentQuizzes: [],
      recentLeads: [],
    };
  }

  const [totalLeads, completedLeads, checkoutClicks, recentLeads] =
    await Promise.all([
      countLeads(quizIds),
      countLeads(quizIds, "completed"),
      countLeads(quizIds, "checkout_clicked"),
      listLeads(user, undefined, 10),
    ]);

  return {
    role: "client",
    summary: {
      quizzes: quizzes.length,
      leads: totalLeads,
      completionRate:
        totalLeads === 0 ? 0 : Math.round((completedLeads / totalLeads) * 100),
      checkoutClicks,
    },
    recentQuizzes: quizzes.slice(0, 5),
    recentLeads,
  };
}

async function getAdminDashboard(
  user: AuthenticatedRequestUser,
): Promise<AdminDashboardData> {
  const [users, activeUsers, quizzes, leads] = await Promise.all([
    countRows("users"),
    countRows("users", { column: "is_active", value: true }),
    countRows("quizzes"),
    countRows("leads"),
  ]);

  return {
    role: "admin",
    summary: {
      users,
      activeUsers,
      quizzes,
      leads,
    },
    recentQuizzes: (await listQuizzes(user)).slice(0, 5),
  };
}

async function countLeads(
  quizIds: string[],
  truthyColumn?: "completed" | "checkout_clicked",
): Promise<number> {
  let query = supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .in("quiz_id", quizIds);

  if (truthyColumn) {
    query = query.eq(truthyColumn, true);
  }

  const { count, error } = await query;

  if (error) {
    throw new AppError(`Não foi possível calcular o resumo: ${error.message}`);
  }

  return count ?? 0;
}

async function countRows(
  table: "users" | "quizzes" | "leads",
  filter?: { column: string; value: boolean },
): Promise<number> {
  let query = supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true });

  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;

  if (error) {
    throw new AppError(`Não foi possível calcular o resumo: ${error.message}`);
  }

  return count ?? 0;
}
