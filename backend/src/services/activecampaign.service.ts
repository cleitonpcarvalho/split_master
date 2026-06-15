import { AppError } from "../models/app-error.js";
import type {
  ActiveCampaignField,
  ActiveCampaignList,
  ActiveCampaignSettings,
  ActiveCampaignTag,
} from "../models/integration.js";
import { decryptSecret } from "./encryption.service.js";

export interface ActiveCampaignCredentials {
  apiUrl: string;
  apiKey: string;
}

export interface ActiveCampaignLead {
  quizId: string;
  quizName: string;
  quizSlug: string;
  name: string | null;
  email: string;
  phone: string | null;
  completed: boolean;
  completedAt: string | null;
  answers: Record<string, unknown>;
  variables: Record<string, unknown>;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

interface ActiveCampaignResponse {
  contact?: { id?: string | number };
  list?: { id?: string | number };
  tag?: { id?: string | number; tag?: string };
  field?: { id?: string | number; title?: string; perstag?: string; type?: string };
  lists?: Array<{ id?: string | number; name?: string }>;
  tags?: Array<{ id?: string | number; tag?: string }>;
  fields?: Array<{
    id?: string | number;
    title?: string;
    perstag?: string;
    type?: string;
  }>;
  meta?: { total?: string | number };
  message?: string;
  errors?: Array<{ title?: string; detail?: string }>;
}

export class IntegrationHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "IntegrationHttpError";
  }
}

export function getActiveCampaignCredentials(
  settings: ActiveCampaignSettings,
): ActiveCampaignCredentials {
  return {
    apiUrl: settings.apiUrl,
    apiKey: decryptSecret(settings.apiKeyEncrypted),
  };
}

export async function testActiveCampaignConnection(
  credentials: ActiveCampaignCredentials,
): Promise<{
  connected: true;
  lists: ActiveCampaignList[];
  tags: ActiveCampaignTag[];
  fields: ActiveCampaignField[];
}> {
  const [lists, tags, fields] = await Promise.all([
    getActiveCampaignLists(credentials),
    getActiveCampaignTags(credentials),
    getActiveCampaignFields(credentials),
  ]);

  return { connected: true, lists, tags, fields };
}

export async function getActiveCampaignLists(
  credentials: ActiveCampaignCredentials,
): Promise<ActiveCampaignList[]> {
  const rows = await getAllPages(credentials, "/lists", "lists");
  return rows
    .map((row) => ({
      id: getId(row.id),
      name: typeof row.name === "string" ? row.name : "",
    }))
    .filter((row) => row.id && row.name);
}

export async function getActiveCampaignTags(
  credentials: ActiveCampaignCredentials,
): Promise<ActiveCampaignTag[]> {
  const rows = await getAllPages(credentials, "/tags", "tags");
  return rows
    .map((row) => ({
      id: getId(row.id),
      name: typeof row.tag === "string" ? row.tag : "",
    }))
    .filter((row) => row.id && row.name);
}

export async function getActiveCampaignFields(
  credentials: ActiveCampaignCredentials,
): Promise<ActiveCampaignField[]> {
  const rows = await getAllPages(credentials, "/fields", "fields");
  return rows
    .map((row) => ({
      id: getId(row.id),
      title: typeof row.title === "string" ? row.title : "",
      perstag: typeof row.perstag === "string" ? row.perstag : "",
      type: typeof row.type === "string" ? row.type : "text",
    }))
    .filter((row) => row.id && row.title);
}

export async function syncLeadToActiveCampaign(
  settings: ActiveCampaignSettings,
  lead: ActiveCampaignLead,
): Promise<void> {
  const credentials = getActiveCampaignCredentials(settings);
  const fields = await getActiveCampaignFields(credentials);
  const extraFields = await ensureExtraFields(credentials, fields);
  const fieldValues = buildFieldValues(settings, lead, extraFields);
  const { firstName, lastName } = splitName(lead.name);
  const response = await activeCampaignRequest(credentials, "/contact/sync", {
    method: "POST",
    body: JSON.stringify({
      contact: {
        email: lead.email,
        firstName,
        lastName,
        phone: lead.phone ?? "",
        fieldValues,
      },
    }),
  });
  const contactId = getId(response.contact?.id);

  if (!contactId) {
    throw new IntegrationHttpError(
      "O ActiveCampaign não retornou o ID do contato.",
    );
  }

  if (settings.listId) {
    await activeCampaignRequest(credentials, "/contactLists", {
      method: "POST",
      body: JSON.stringify({
        contactList: {
          list: settings.listId,
          contact: contactId,
          status: 1,
        },
      }),
    });
  }

  const tags = getLeadTags(settings, lead);
  await addTagsToContact(credentials, contactId, tags);
}

export function normalizeActiveCampaignUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError("Informe uma API URL válida do ActiveCampaign.", 400);
  }

  const allowedHost =
    /^[a-z0-9-]+\.api-[a-z0-9-]+\.com$/i.test(url.hostname) ||
    url.hostname.endsWith(".activehosted.com");

  if (url.protocol !== "https:" || !allowedHost) {
    throw new AppError(
      "Use a URL HTTPS fornecida pelo ActiveCampaign.",
      400,
    );
  }

  const path = url.pathname.replace(/\/+$/, "").replace(/\/api\/3$/i, "");
  return `${url.origin}${path}`;
}

async function getAllPages(
  credentials: ActiveCampaignCredentials,
  path: string,
  key: "lists" | "tags" | "fields",
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (rows.length < total && offset < 10_000) {
    const response = await activeCampaignRequest(
      credentials,
      `${path}?limit=${limit}&offset=${offset}`,
    );
    const page = (response[key] ?? []) as Array<Record<string, unknown>>;
    rows.push(...page);
    total = Number(response.meta?.total ?? rows.length);

    if (page.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

async function ensureExtraFields(
  credentials: ActiveCampaignCredentials,
  existing: ActiveCampaignField[],
): Promise<Map<string, string>> {
  const definitions = [
    ["QUIZ_ID", "Quiz ID"],
    ["QUIZ_NAME", "Quiz Name"],
    ["COMPLETED_AT", "Quiz Completed At"],
    ["UTM_SOURCE", "UTM Source"],
    ["UTM_MEDIUM", "UTM Medium"],
    ["UTM_CAMPAIGN", "UTM Campaign"],
  ] as const;
  const result = new Map(
    existing
      .filter((field) => field.perstag)
      .map((field) => [field.perstag.toUpperCase(), field.id]),
  );

  for (const [perstag, title] of definitions) {
    if (result.has(perstag)) {
      continue;
    }

    try {
      const response = await activeCampaignRequest(credentials, "/fields", {
        method: "POST",
        body: JSON.stringify({
          field: {
            type: "text",
            title,
            perstag,
          },
        }),
      });
      const id = getId(response.field?.id);

      if (id) {
        result.set(perstag, id);
      }
    } catch (error) {
      if (!(error instanceof IntegrationHttpError) || error.status !== 422) {
        throw error;
      }

      const refreshed = await getActiveCampaignFields(credentials);
      const field = refreshed.find(
        (item) => item.perstag.toUpperCase() === perstag,
      );

      if (field) {
        result.set(perstag, field.id);
      }
    }
  }

  return result;
}

function buildFieldValues(
  settings: ActiveCampaignSettings,
  lead: ActiveCampaignLead,
  extraFields: Map<string, string>,
): Array<{ field: string; value: string }> {
  const mapped = settings.fieldMappings.flatMap((mapping) => {
    const value = normalizeFieldValue(lead.variables[mapping.variable]);
    return value ? [{ field: mapping.fieldId, value }] : [];
  });
  const extras: Array<[string, string | null]> = [
    ["QUIZ_ID", lead.quizId],
    ["QUIZ_NAME", lead.quizName],
    ["COMPLETED_AT", lead.completedAt],
    ["UTM_SOURCE", lead.utmSource],
    ["UTM_MEDIUM", lead.utmMedium],
    ["UTM_CAMPAIGN", lead.utmCampaign],
  ];

  return [
    ...mapped,
    ...extras.flatMap(([tag, value]) => {
      const field = extraFields.get(tag);
      return field && value ? [{ field, value }] : [];
    }),
  ];
}

function getLeadTags(
  settings: ActiveCampaignSettings,
  lead: ActiveCampaignLead,
): string[] {
  const answerTags = settings.answerTags.flatMap((mapping) =>
    normalizeFieldValue(lead.answers[mapping.questionId]) === mapping.optionValue
      ? [mapping.tag]
      : [],
  );

  return Array.from(
    new Set(
      [
        ...settings.defaultTags,
        ...answerTags,
        `quiz-${lead.quizSlug}`,
        lead.completed ? "quiz_completed" : "",
      ]
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

async function addTagsToContact(
  credentials: ActiveCampaignCredentials,
  contactId: string,
  names: string[],
): Promise<void> {
  if (names.length === 0) {
    return;
  }

  const existing = await getActiveCampaignTags(credentials);
  const tagIds = new Map(
    existing.map((tag) => [tag.name.toLowerCase(), tag.id]),
  );

  for (const name of names) {
    let tagId = tagIds.get(name.toLowerCase());

    if (!tagId) {
      const response = await activeCampaignRequest(credentials, "/tags", {
        method: "POST",
        body: JSON.stringify({
          tag: { tag: name, tagType: "contact", description: "" },
        }),
      });
      tagId = getId(response.tag?.id);
    }

    if (!tagId) {
      continue;
    }

    try {
      await activeCampaignRequest(credentials, "/contactTags", {
        method: "POST",
        body: JSON.stringify({
          contactTag: { contact: contactId, tag: tagId },
        }),
      });
    } catch (error) {
      if (!(error instanceof IntegrationHttpError) || error.status !== 422) {
        throw error;
      }
    }
  }
}

async function activeCampaignRequest(
  credentials: ActiveCampaignCredentials,
  path: string,
  init: RequestInit = {},
): Promise<ActiveCampaignResponse> {
  const baseUrl = normalizeActiveCampaignUrl(credentials.apiUrl);
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/3${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Api-Token": credentials.apiKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new IntegrationHttpError(
      error instanceof Error
        ? `Falha ao conectar ao ActiveCampaign: ${error.message}`
        : "Falha ao conectar ao ActiveCampaign.",
    );
  }

  const payload = (await response.json().catch(() => ({}))) as
    ActiveCampaignResponse;

  if (!response.ok) {
    const details =
      payload.errors?.[0]?.detail ||
      payload.errors?.[0]?.title ||
      payload.message ||
      `O ActiveCampaign respondeu com status ${response.status}.`;
    throw new IntegrationHttpError(details, response.status);
  }

  return payload;
}

function splitName(value: string | null): {
  firstName: string;
  lastName: string;
} {
  const [firstName = "", ...remaining] = (value ?? "").trim().split(/\s+/);
  return { firstName, lastName: remaining.join(" ") };
}

function normalizeFieldValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

function getId(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
