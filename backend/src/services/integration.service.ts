import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type {
  ActiveCampaignSettings,
  Integration,
  IntegrationRow,
  IntegrationType,
  IntegrationWithQuizRow,
  WebhookSettings,
} from "../models/integration.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import {
  type ActiveCampaignCredentials,
  normalizeActiveCampaignUrl,
  testActiveCampaignConnection,
} from "./activecampaign.service.js";
import { encryptSecret } from "./encryption.service.js";
import { findAccessibleQuiz } from "./quiz.service.js";
import { assertSafeWebhookUrl } from "./webhook.service.js";

interface SaveIntegrationInput {
  quizId: string;
  type: IntegrationType;
  settings: Record<string, unknown>;
  isActive?: boolean;
}

const integrationColumns =
  "id,quiz_id,type,settings,is_active,created_at,updated_at";

export async function listIntegrations(
  user: AuthenticatedRequestUser,
  filters: { quizId?: string } = {},
): Promise<Integration[]> {
  let query = supabaseAdmin
    .from("quiz_integrations")
    .select(`${integrationColumns},quiz:quizzes!inner(id,title,user_id)`)
    .order("created_at", { ascending: false });

  if (filters.quizId) {
    await findAccessibleQuiz(user, filters.quizId);
    query = query.eq("quiz_id", filters.quizId);
  } else if (user.role !== "admin") {
    query = query.eq("quiz.user_id", user.id);
  }

  const { data, error } = await query.returns<IntegrationWithQuizRow[]>();

  if (error) {
    throw new AppError(
      `Não foi possível listar as integrações: ${error.message}`,
    );
  }

  return data.map(mapIntegration);
}

export async function saveIntegration(
  user: AuthenticatedRequestUser,
  input: SaveIntegrationInput,
): Promise<Integration> {
  const quiz = await findAccessibleQuiz(user, input.quizId);
  const existing = await findIntegration(input.quizId, input.type);
  const settings = await prepareSettings(input.type, input.settings, existing);
  const { data, error } = await supabaseAdmin
    .from("quiz_integrations")
    .upsert(
      {
        quiz_id: quiz.id,
        type: input.type,
        settings,
        is_active: input.isActive ?? true,
      },
      { onConflict: "quiz_id,type" },
    )
    .select(integrationColumns)
    .single<IntegrationRow>();

  if (error) {
    throw new AppError(
      `Não foi possível salvar a integração: ${error.message}`,
    );
  }

  return mapIntegration({
    ...data,
    quiz: { id: quiz.id, title: quiz.title, user_id: quiz.user_id },
  });
}

export async function deleteIntegration(
  user: AuthenticatedRequestUser,
  id: string,
): Promise<void> {
  const integration = await findIntegrationById(id);
  await findAccessibleQuiz(user, integration.quiz_id);
  const { error } = await supabaseAdmin
    .from("quiz_integrations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new AppError(
      `Não foi possível remover a integração: ${error.message}`,
    );
  }
}

export async function resolveActiveCampaignCredentials(
  user: AuthenticatedRequestUser,
  input: {
    quizId?: string;
    apiUrl?: string;
    apiKey?: string;
  },
): Promise<ActiveCampaignCredentials> {
  if (input.apiUrl && input.apiKey) {
    return {
      apiUrl: normalizeActiveCampaignUrl(input.apiUrl),
      apiKey: input.apiKey,
    };
  }

  if (!input.quizId) {
    throw new AppError("Informe as credenciais ou um quiz configurado.", 400);
  }

  await findAccessibleQuiz(user, input.quizId);
  const integration = await findIntegration(input.quizId, "activecampaign");

  if (!integration) {
    throw new AppError("ActiveCampaign ainda não foi configurado.", 404);
  }

  const settings = parseActiveCampaignSettings(integration.settings);
  const { getActiveCampaignCredentials } = await import(
    "./activecampaign.service.js"
  );
  return getActiveCampaignCredentials(settings);
}

export async function logIntegrationAttempt(input: {
  integrationId: string;
  quizId: string;
  leadId?: string | null;
  event: string;
  status: "success" | "error";
  attempt: number;
  message?: string;
  responseStatus?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("integration_logs").insert({
    integration_id: input.integrationId,
    quiz_id: input.quizId,
    lead_id: input.leadId ?? null,
    event: input.event,
    status: input.status,
    attempt: input.attempt,
    message: input.message?.slice(0, 1000),
    response_status: input.responseStatus,
  });

  if (error) {
    console.error("Falha ao salvar log de integração:", error.message);
  }
}

export async function listActiveIntegrationsForQuiz(
  quizId: string,
): Promise<IntegrationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("quiz_integrations")
    .select(integrationColumns)
    .eq("quiz_id", quizId)
    .eq("is_active", true)
    .in("type", ["activecampaign", "webhook"])
    .returns<IntegrationRow[]>();

  if (error) {
    throw new AppError(
      `Não foi possível carregar integrações: ${error.message}`,
    );
  }

  return data;
}

export function parseActiveCampaignSettings(
  settings: Record<string, unknown>,
): ActiveCampaignSettings {
  return {
    apiUrl: getString(settings.apiUrl),
    apiKeyEncrypted: getString(settings.apiKeyEncrypted),
    listId: getOptionalString(settings.listId),
    defaultTags: getStringArray(settings.defaultTags),
    fieldMappings: Array.isArray(settings.fieldMappings)
      ? settings.fieldMappings
          .map((item) => ({
            variable: getString((item as Record<string, unknown>).variable),
            fieldId: getString((item as Record<string, unknown>).fieldId),
          }))
          .filter((item) => item.variable && item.fieldId)
      : [],
    answerTags: Array.isArray(settings.answerTags)
      ? settings.answerTags
          .map((item) => ({
            questionId: getString((item as Record<string, unknown>).questionId),
            optionValue: getString(
              (item as Record<string, unknown>).optionValue,
            ),
            tag: getString((item as Record<string, unknown>).tag),
          }))
          .filter((item) => item.questionId && item.optionValue && item.tag)
      : [],
  };
}

export function parseWebhookSettings(
  settings: Record<string, unknown>,
): WebhookSettings {
  return {
    url: getString(settings.url),
    method: settings.method === "GET" ? "GET" : "POST",
    headers: getStringRecord(settings.headers),
  };
}

async function prepareSettings(
  type: IntegrationType,
  settings: Record<string, unknown>,
  existing: IntegrationRow | null,
): Promise<Record<string, unknown>> {
  if (type === "activecampaign") {
    const previous = existing
      ? parseActiveCampaignSettings(existing.settings)
      : null;
    const apiUrl = normalizeActiveCampaignUrl(
      getString(settings.apiUrl) || previous?.apiUrl || "",
    );
    const apiKey = getOptionalString(settings.apiKey);
    const apiKeyEncrypted =
      apiKey !== null
        ? encryptSecret(apiKey)
        : previous?.apiKeyEncrypted ?? "";

    if (!apiKeyEncrypted) {
      throw new AppError("Informe a API Key do ActiveCampaign.", 400);
    }

    if (apiKey) {
      await testActiveCampaignConnection({ apiUrl, apiKey });
    }

    return {
      apiUrl,
      apiKeyEncrypted,
      listId: getOptionalString(settings.listId),
      defaultTags: getStringArray(settings.defaultTags),
      fieldMappings: parseActiveCampaignSettings({
        fieldMappings: settings.fieldMappings,
      }).fieldMappings,
      answerTags: parseActiveCampaignSettings({
        answerTags: settings.answerTags,
      }).answerTags,
    };
  }

  if (type === "webhook") {
    const webhook = parseWebhookSettings(settings);
    assertSafeWebhookUrl(webhook.url);
    return { ...webhook };
  }

  return {
    pixelId: getString(settings.pixelId),
  };
}

async function findIntegration(
  quizId: string,
  type: IntegrationType,
): Promise<IntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("quiz_integrations")
    .select(integrationColumns)
    .eq("quiz_id", quizId)
    .eq("type", type)
    .maybeSingle<IntegrationRow>();

  if (error) {
    throw new AppError(
      `Não foi possível buscar a integração: ${error.message}`,
    );
  }

  return data;
}

async function findIntegrationById(id: string): Promise<IntegrationRow> {
  const { data, error } = await supabaseAdmin
    .from("quiz_integrations")
    .select(integrationColumns)
    .eq("id", id)
    .maybeSingle<IntegrationRow>();

  if (error) {
    throw new AppError(
      `Não foi possível buscar a integração: ${error.message}`,
    );
  }
  if (!data) {
    throw new AppError("Integração não encontrada.", 404);
  }

  return data;
}

function mapIntegration(row: IntegrationWithQuizRow): Integration {
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz.title,
    type: row.type,
    settings: sanitizeSettings(row.type, row.settings),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeSettings(
  type: IntegrationType,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  if (type === "activecampaign") {
    const parsed = parseActiveCampaignSettings(settings);
    return {
      apiUrl: parsed.apiUrl,
      hasApiKey: Boolean(parsed.apiKeyEncrypted),
      listId: parsed.listId,
      defaultTags: parsed.defaultTags,
      fieldMappings: parsed.fieldMappings,
      answerTags: parsed.answerTags,
    };
  }

  return settings;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown): string | null {
  const stringValue = getString(value);
  return stringValue ? stringValue : null;
}

function getStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, item]) =>
          key.trim().length > 0 && typeof item === "string" && item.trim(),
      )
      .map(([key, item]) => [key.trim(), (item as string).trim()]),
  );
}
