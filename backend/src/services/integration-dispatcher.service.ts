import { supabaseAdmin } from "../config/supabase.js";
import type { IntegrationRow } from "../models/integration.js";
import {
  IntegrationHttpError,
  syncLeadToActiveCampaign,
} from "./activecampaign.service.js";
import {
  listActiveIntegrationsForQuiz,
  logIntegrationAttempt,
  parseActiveCampaignSettings,
  parseWebhookSettings,
} from "./integration.service.js";
import {
  type WebhookLeadPayload,
  sendWebhook,
} from "./webhook.service.js";

type LeadIntegrationEvent = "lead.created" | "lead.updated";

interface LeadIntegrationRow {
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
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  quiz: {
    id: string;
    title: string;
    slug: string;
  };
}

export function queueLeadIntegrations(
  leadId: string,
  event: LeadIntegrationEvent,
): void {
  setTimeout(() => {
    dispatchLeadIntegrations(leadId, event).catch((error: unknown) => {
      console.error("Falha no dispatcher de integrações:", error);
    });
  }, 0);
}

async function dispatchLeadIntegrations(
  leadId: string,
  event: LeadIntegrationEvent,
): Promise<void> {
  const lead = await loadLead(leadId);
  const integrations = await listActiveIntegrationsForQuiz(lead.quiz_id);

  await Promise.all(
    integrations.map((integration) =>
      executeWithRetries(integration, lead, event),
    ),
  );
}

async function executeWithRetries(
  integration: IntegrationRow,
  lead: LeadIntegrationRow,
  event: LeadIntegrationEvent,
): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (integration.type === "activecampaign") {
        await dispatchActiveCampaign(integration, lead);
      }
      if (integration.type === "webhook") {
        await dispatchWebhook(integration, lead, event);
      }

      await logIntegrationAttempt({
        integrationId: integration.id,
        quizId: lead.quiz_id,
        leadId: lead.id,
        event,
        status: "success",
        attempt,
        message: "Integração enviada com sucesso.",
      });
      return;
    } catch (error) {
      const status =
        error instanceof IntegrationHttpError ? error.status : undefined;
      await logIntegrationAttempt({
        integrationId: integration.id,
        quizId: lead.quiz_id,
        leadId: lead.id,
        event,
        status: "error",
        attempt,
        message:
          error instanceof Error ? error.message : "Falha desconhecida.",
        responseStatus: status,
      });

      if (attempt < 3) {
        await wait(attempt * 1000);
      } else {
        console.error(
          `Integração ${integration.type} falhou para lead ${lead.id}.`,
          error,
        );
      }
    }
  }
}

async function dispatchActiveCampaign(
  integration: IntegrationRow,
  lead: LeadIntegrationRow,
): Promise<void> {
  if (!lead.email) {
    return;
  }

  await syncLeadToActiveCampaign(
    parseActiveCampaignSettings(integration.settings),
    {
      quizId: lead.quiz.id,
      quizName: lead.quiz.title,
      quizSlug: lead.quiz.slug,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      completed: lead.completed,
      completedAt: lead.completed_at,
      answers: lead.answers,
      variables: lead.variables,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
    },
  );
}

async function dispatchWebhook(
  integration: IntegrationRow,
  lead: LeadIntegrationRow,
  event: LeadIntegrationEvent,
): Promise<void> {
  const payload: WebhookLeadPayload = {
    event,
    quiz_id: lead.quiz.id,
    quiz_name: lead.quiz.title,
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      completed: lead.completed,
      answers: lead.answers,
      variables: lead.variables,
      tags: lead.tags,
      utm_source: lead.utm_source,
      created_at: lead.created_at,
    },
  };

  await sendWebhook(parseWebhookSettings(integration.settings), payload);
}

async function loadLead(id: string): Promise<LeadIntegrationRow> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select(
      "id,quiz_id,name,email,phone,answers,variables,tags,utm_source,utm_medium,utm_campaign,completed,completed_at,created_at,quiz:quizzes!inner(id,title,slug)",
    )
    .eq("id", id)
    .maybeSingle<LeadIntegrationRow>();

  if (error) {
    throw new Error(`Não foi possível carregar o lead: ${error.message}`);
  }
  if (!data) {
    throw new Error("Lead não encontrado para integração.");
  }

  return data;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
