import bcrypt from "bcrypt";

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import { toPublicUser, type PublicUser, type UserRow } from "../models/user.js";

const passwordSaltRounds = 12;
const userColumns =
  "id,email,name,password_hash,role,plan,is_active,created_at,updated_at";

export async function updateProfile(
  id: string,
  input: { name: string; email: string },
): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .neq("id", id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing) {
    throw new AppError("Este e-mail já está em uso.", 409);
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      name: input.name.trim(),
      email,
    })
    .eq("id", id)
    .select(userColumns)
    .single<UserRow>();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("Este e-mail já está em uso.", 409);
    }

    throw new AppError(`Não foi possível atualizar o perfil: ${error.message}`);
  }

  return toPublicUser(data);
}

export async function updatePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", id)
    .maybeSingle<{ password_hash: string }>();

  if (error) {
    throw new AppError(`Não foi possível validar a senha: ${error.message}`);
  }

  if (!data) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  const matches = await bcrypt.compare(currentPassword, data.password_hash);

  if (!matches) {
    throw new AppError("A senha atual está incorreta.", 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, passwordSaltRounds);
  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", id);

  if (updateError) {
    throw new AppError(
      `Não foi possível atualizar a senha: ${updateError.message}`,
    );
  }
}
