import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import {
  toPublicUser,
  type UserPlan,
  type UserRow,
} from "../models/user.js";

interface AdminUserWithCount extends UserRow {
  quizzes: Array<{ count: number }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRow["role"];
  plan: UserPlan;
  isActive: boolean;
  createdAt: string;
  quizzesCount: number;
}

export async function listUsers(filters: {
  plan?: UserPlan;
  isActive?: boolean;
}): Promise<AdminUser[]> {
  let query = supabaseAdmin
    .from("users")
    .select(
      "id,email,name,password_hash,role,plan,is_active,created_at,updated_at,quizzes(count)",
    )
    .order("created_at", { ascending: false });

  if (filters.plan) {
    query = query.eq("plan", filters.plan);
  }

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error } = await query.returns<AdminUserWithCount[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os usuários: ${error.message}`);
  }

  return data.map(mapAdminUser);
}

export async function updateUserByAdmin(
  currentAdminId: string,
  id: string,
  input: {
    plan?: UserPlan;
    isActive?: boolean;
  },
): Promise<AdminUser> {
  if (id === currentAdminId && input.isActive === false) {
    throw new AppError("Você não pode desativar sua própria conta.", 400);
  }

  const update: Record<string, unknown> = {};

  if (input.plan !== undefined) {
    update.plan = input.plan;
  }
  if (input.isActive !== undefined) {
    update.is_active = input.isActive;
  }

  const { error } = await supabaseAdmin.from("users").update(update).eq("id", id);

  if (error) {
    throw new AppError(`Não foi possível atualizar o usuário: ${error.message}`);
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("users")
    .select(
      "id,email,name,password_hash,role,plan,is_active,created_at,updated_at,quizzes(count)",
    )
    .eq("id", id)
    .maybeSingle<AdminUserWithCount>();

  if (fetchError) {
    throw new AppError(
      `Não foi possível recarregar o usuário: ${fetchError.message}`,
    );
  }

  if (!data) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  return mapAdminUser(data);
}

function mapAdminUser(user: AdminUserWithCount): AdminUser {
  const publicUser = toPublicUser(user);

  return {
    id: publicUser.id,
    name: publicUser.name,
    email: publicUser.email,
    role: publicUser.role,
    plan: publicUser.plan,
    isActive: publicUser.isActive,
    createdAt: publicUser.createdAt,
    quizzesCount: user.quizzes[0]?.count ?? 0,
  };
}
