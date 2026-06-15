export const integrationTypes = [
  "activecampaign",
  "webhook",
  "pixel_facebook",
  "gtm",
  "ga4",
] as const;

export type IntegrationType = (typeof integrationTypes)[number];

export interface FieldMapping {
  variable: string;
  fieldId: string;
}

export interface AnswerTagMapping {
  questionId: string;
  optionValue: string;
  tag: string;
}

export interface ActiveCampaignSettings {
  apiUrl: string;
  apiKeyEncrypted: string;
  listId: string | null;
  defaultTags: string[];
  fieldMappings: FieldMapping[];
  answerTags: AnswerTagMapping[];
}

export interface WebhookSettings {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
}

export interface PixelSettings {
  pixelId: string;
}

export interface IntegrationRow {
  id: string;
  quiz_id: string;
  type: IntegrationType;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationWithQuizRow extends IntegrationRow {
  quiz: {
    id: string;
    title: string;
    user_id: string;
  };
}

export interface Integration {
  id: string;
  quizId: string;
  quizTitle: string;
  type: IntegrationType;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveCampaignList {
  id: string;
  name: string;
}

export interface ActiveCampaignTag {
  id: string;
  name: string;
}

export interface ActiveCampaignField {
  id: string;
  title: string;
  perstag: string;
  type: string;
}

export interface PublicTrackingSettings {
  facebookPixelId: string | null;
  gtmId: string | null;
  ga4Id: string | null;
  scripts: {
    facebook: string | null;
    gtm: string | null;
    ga4: string | null;
  };
}
