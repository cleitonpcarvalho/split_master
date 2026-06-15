import bcrypt from "bcrypt";

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import {
  type AuthTokenPayload,
  type PublicUser,
  toPublicUser,
  type UserRole,
  type UserRow,
} from "../models/user.js";
import { createToken } from "./token.service.js";

const passwordSaltRounds = 12;
const userColumns =
  "id,email,name,password_hash,role,plan,is_active,created_at,updated_at";
const publicUserColumns =
  "id,email,name,role,plan,is_active,created_at,updated_at";

interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export async function registerUser(
  input: RegisterUserInput,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError("Já existe uma conta com este e-mail.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      name: input.name.trim(),
      email,
      password_hash: passwordHash,
      role: input.role,
      plan: "free",
    })
    .select(userColumns)
    .single<UserRow>();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("Já existe uma conta com este e-mail.", 409);
    }

    throw new AppError(`Não foi possível criar a conta: ${error.message}`);
  }

  return buildAuthResult(data);
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(normalizeEmail(input.email));

  if (!user) {
    throw new AppError("E-mail ou senha inválidos.", 401);
  }

  if (!user.is_active) {
    throw new AppError("Esta conta está desativada.", 403);
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new AppError("E-mail ou senha inválidos.", 401);
  }

  return buildAuthResult(user);
}

export async function getUserById(id: string): Promise<PublicUser> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(publicUserColumns)
    .eq("id", id)
    .maybeSingle<Omit<UserRow, "password_hash">>();

  if (error) {
    throw new AppError(`Não foi possível carregar o usuário: ${error.message}`);
  }

  if (!data || !data.is_active) {
    throw new AppError("Usuário não encontrado ou desativado.", 401);
  }

  return toPublicUser({
    ...data,
    password_hash: "",
  });
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(userColumns)
    .eq("email", email)
    .maybeSingle<UserRow>();

  if (error) {
    throw new AppError(`Não foi possível consultar o usuário: ${error.message}`);
  }

  return data;
}

function buildAuthResult(user: UserRow): AuthResult {
  const tokenPayload: AuthTokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
  };

  return {
    token: createToken(tokenPayload),
    user: toPublicUser(user),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
