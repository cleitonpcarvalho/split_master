import { env } from "../config/env.js";
import { AppError } from "../models/app-error.js";
import type { WebhookSettings } from "../models/integration.js";
import { IntegrationHttpError } from "./activecampaign.service.js";

export interface WebhookLeadPayload {
  event: "lead.created" | "lead.updated";
  quiz_id: string;
  quiz_name: string;
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    completed: boolean;
    answers: Record<string, unknown>;
    variables: Record<string, unknown>;
    tags: string[];
    utm_source: string | null;
    created_at: string;
  };
}

export async function testWebhook(
  settings: WebhookSettings,
): Promise<{ delivered: true; status: number }> {
  const payload: WebhookLeadPayload = {
    event: "lead.created",
    quiz_id: "00000000-0000-0000-0000-000000000000",
    quiz_name: "Quiz de teste Split Master",
    lead: {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Lead de teste",
      email: "teste@splitmaster.com",
      phone: "11999999999",
      completed: true,
      answers: { pergunta: "resposta" },
      variables: { name: "Lead de teste" },
      tags: ["split-master-test"],
      utm_source: "split-master",
      created_at: new Date().toISOString(),
    },
  };
  const status = await sendWebhook(settings, payload);
  return { delivered: true, status };
}

export async function sendWebhook(
  settings: WebhookSettings,
  payload: WebhookLeadPayload,
): Promise<number> {
  const url = assertSafeWebhookUrl(settings.url);
  const isGet = settings.method === "GET";

  if (isGet) {
    url.searchParams.set("event", payload.event);
    url.searchParams.set("quiz_id", payload.quiz_id);
    url.searchParams.set("quiz_name", payload.quiz_name);
    url.searchParams.set("lead", JSON.stringify(payload.lead));
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: settings.method,
      headers: {
        ...(isGet ? {} : { "Content-Type": "application/json" }),
        ...settings.headers,
      },
      body: isGet ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new IntegrationHttpError(
      error instanceof Error
        ? `Falha ao chamar o webhook: ${error.message}`
        : "Falha ao chamar o webhook.",
    );
  }

  if (!response.ok) {
    throw new IntegrationHttpError(
      `O webhook respondeu com status ${response.status}.`,
      response.status,
    );
  }

  return response.status;
}

export function assertSafeWebhookUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new AppError("Informe uma URL de webhook válida.", 400);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError("O webhook deve usar HTTP ou HTTPS.", 400);
  }

  if (env.nodeEnv === "production" && isPrivateHostname(url.hostname)) {
    throw new AppError("O webhook deve apontar para um endereço público.", 400);
  }

  return url;
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.")
  ) {
    return true;
  }

  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}
