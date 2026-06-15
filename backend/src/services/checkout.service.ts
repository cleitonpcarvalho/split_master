import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import {
  type CheckoutConfig,
  type CheckoutConfigRow,
  type CheckoutProvider,
  checkoutProviderTemplates,
} from "../models/checkout.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import { findAccessibleQuiz } from "./quiz.service.js";

interface CheckoutInput {
  provider: CheckoutProvider;
  checkoutUrl: string;
  urlTemplate?: string;
  customParams?: Record<string, string>;
  isActive?: boolean;
}

const checkoutColumns =
  "id,quiz_id,provider,checkout_url,url_template,custom_params,is_active,created_at,updated_at";

export async function listCheckoutConfigs(
  user: AuthenticatedRequestUser,
  quizId: string,
): Promise<CheckoutConfig[]> {
  await findAccessibleQuiz(user, quizId);
  const { data, error } = await supabaseAdmin
    .from("checkout_configs")
    .select(checkoutColumns)
    .eq("quiz_id", quizId)
    .order("created_at")
    .returns<CheckoutConfigRow[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os checkouts: ${error.message}`);
  }

  return data.map(mapCheckout);
}

export async function createCheckoutConfig(
  user: AuthenticatedRequestUser,
  quizId: string,
  input: CheckoutInput,
): Promise<CheckoutConfig> {
  await findAccessibleQuiz(user, quizId);
  assertHttpUrl(input.checkoutUrl);
  const { data, error } = await supabaseAdmin
    .from("checkout_configs")
    .insert({
      quiz_id: quizId,
      provider: input.provider,
      checkout_url: input.checkoutUrl,
      url_template:
        input.urlTemplate?.trim() || checkoutProviderTemplates[input.provider],
      custom_params: input.customParams ?? {},
      is_active: input.isActive ?? true,
    })
    .select(checkoutColumns)
    .single<CheckoutConfigRow>();

  if (error) {
    throw new AppError(`Não foi possível criar o checkout: ${error.message}`);
  }

  return mapCheckout(data);
}

export async function updateCheckoutConfig(
  user: AuthenticatedRequestUser,
  quizId: string,
  checkoutId: string,
  input: Partial<CheckoutInput>,
): Promise<CheckoutConfig> {
  await findAccessibleQuiz(user, quizId);
  await findCheckout(quizId, checkoutId);
  const update: Record<string, unknown> = {};

  if (input.provider !== undefined) {
    update.provider = input.provider;
  }
  if (input.checkoutUrl !== undefined) {
    assertHttpUrl(input.checkoutUrl);
    update.checkout_url = input.checkoutUrl;
  }
  if (input.urlTemplate !== undefined) {
    update.url_template = input.urlTemplate.trim();
  }
  if (input.customParams !== undefined) {
    update.custom_params = input.customParams;
  }
  if (input.isActive !== undefined) {
    update.is_active = input.isActive;
  }

  const { data, error } = await supabaseAdmin
    .from("checkout_configs")
    .update(update)
    .eq("id", checkoutId)
    .eq("quiz_id", quizId)
    .select(checkoutColumns)
    .single<CheckoutConfigRow>();

  if (error) {
    throw new AppError(`Não foi possível atualizar o checkout: ${error.message}`);
  }

  return mapCheckout(data);
}

export async function deleteCheckoutConfig(
  user: AuthenticatedRequestUser,
  quizId: string,
  checkoutId: string,
): Promise<void> {
  await findAccessibleQuiz(user, quizId);
  await findCheckout(quizId, checkoutId);
  const { error } = await supabaseAdmin
    .from("checkout_configs")
    .delete()
    .eq("id", checkoutId)
    .eq("quiz_id", quizId);

  if (error) {
    throw new AppError(`Não foi possível excluir o checkout: ${error.message}`);
  }
}

export async function getPublicCheckoutUrl(
  slug: string,
  leadId: string,
  writeToken: string,
  checkoutId?: string,
): Promise<{
  url: string;
  checkoutId: string;
  provider: CheckoutProvider;
}> {
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (quizError) {
    throw new AppError(`Não foi possível carregar o quiz: ${quizError.message}`);
  }
  if (!quiz) {
    throw new AppError("Quiz não encontrado ou indisponível.", 404);
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("id,quiz_id,name,email,phone,variables")
    .eq("id", leadId)
    .eq("quiz_id", quiz.id)
    .eq("public_token", writeToken)
    .maybeSingle<{
      id: string;
      quiz_id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      variables: Record<string, unknown>;
    }>();

  if (leadError) {
    throw new AppError(`Não foi possível carregar o lead: ${leadError.message}`);
  }
  if (!lead) {
    throw new AppError("Lead não encontrado ou token inválido.", 404);
  }

  let query = supabaseAdmin
    .from("checkout_configs")
    .select(checkoutColumns)
    .eq("quiz_id", quiz.id)
    .eq("is_active", true)
    .order("created_at")
    .limit(1);

  if (checkoutId) {
    query = query.eq("id", checkoutId);
  }

  const { data: checkout, error: checkoutError } =
    await query.maybeSingle<CheckoutConfigRow>();

  if (checkoutError) {
    throw new AppError(
      `Não foi possível carregar o checkout: ${checkoutError.message}`,
    );
  }
  if (!checkout) {
    throw new AppError("Nenhum checkout ativo foi configurado.", 404);
  }

  const variables = Object.fromEntries(
    Object.entries({
      ...lead.variables,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
    }).map(([key, value]) => [key, normalizeValue(value)]),
  );

  return {
    url: buildCheckoutUrl(checkout, variables),
    checkoutId: checkout.id,
    provider: checkout.provider,
  };
}

export function buildCheckoutUrl(
  checkout: Pick<
    CheckoutConfigRow,
    "checkout_url" | "url_template" | "custom_params"
  >,
  variables: Record<string, string>,
): string {
  assertHttpUrl(checkout.checkout_url);
  const baseUrl = new URL(checkout.checkout_url);
  const template = checkout.url_template.trim() || "{url}";
  const queryTemplate = getTemplateQuery(template, checkout.checkout_url);

  queryTemplate.forEach((value, key) => {
    const resolved = resolveTemplate(value, variables);

    if (resolved === null || resolved === "") {
      baseUrl.searchParams.delete(key);
    } else {
      baseUrl.searchParams.set(key, resolved);
    }
  });

  Object.entries(checkout.custom_params).forEach(([key, value]) => {
    const resolved = resolveTemplate(value, variables);

    if (resolved !== null && resolved !== "") {
      baseUrl.searchParams.set(key, resolved);
    } else {
      baseUrl.searchParams.delete(key);
    }
  });

  return baseUrl.toString();
}

async function findCheckout(
  quizId: string,
  checkoutId: string,
): Promise<CheckoutConfigRow> {
  const { data, error } = await supabaseAdmin
    .from("checkout_configs")
    .select(checkoutColumns)
    .eq("id", checkoutId)
    .eq("quiz_id", quizId)
    .maybeSingle<CheckoutConfigRow>();

  if (error) {
    throw new AppError(`Não foi possível buscar o checkout: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Checkout não encontrado.", 404);
  }

  return data;
}

function getTemplateQuery(template: string, checkoutUrl: string): URLSearchParams {
  if (template.includes("{url}")) {
    const suffix = template.split("{url}", 2)[1] ?? "";

    if (!suffix || suffix === checkoutUrl) {
      return new URLSearchParams();
    }

    const queryStart = suffix.indexOf("?");
    return new URLSearchParams(queryStart >= 0 ? suffix.slice(queryStart + 1) : "");
  }

  try {
    return new URL(template).searchParams;
  } catch {
    throw new AppError("O template de checkout é inválido.", 400);
  }
}

function resolveTemplate(
  template: string,
  variables: Record<string, string>,
): string | null {
  let missing = false;
  const resolved = template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => {
      const value = variables[name]?.trim() ?? "";

      if (!value) {
        missing = true;
      }

      return value;
    },
  );

  return missing ? null : resolved;
}

function assertHttpUrl(value: string): void {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("protocol");
    }
  } catch {
    throw new AppError("Informe uma URL de checkout válida.", 400);
  }
}

function normalizeValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function mapCheckout(row: CheckoutConfigRow): CheckoutConfig {
  return {
    id: row.id,
    quizId: row.quiz_id,
    provider: row.provider,
    checkoutUrl: row.checkout_url,
    urlTemplate: row.url_template,
    customParams: row.custom_params,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
