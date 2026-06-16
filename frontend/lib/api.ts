import {
  type AuthSession,
  type AuthUser,
  clearToken,
  getStoredToken,
} from "./auth";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
).replace(/\/$/, "");

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  return apiRequest<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      role: "client",
    }),
  });
}

export async function login(input: LoginInput): Promise<AuthSession> {
  return apiRequest<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export type QuizStatus = "draft" | "active" | "inactive";
export type QuestionType =
  | "multiple_choice"
  | "text"
  | "name"
  | "email"
  | "phone"
  | "number";
export type OptionNextStep = "default" | "question" | "final";
export type FinalPageBlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "image"
  | "video"
  | "bullets"
  | "testimonial"
  | "cta_button"
  | "checkout_button"
  | "divider"
  | "spacer";
export type CheckoutProvider =
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "stripe"
  | "custom";
export type IntegrationType =
  | "activecampaign"
  | "webhook"
  | "pixel_facebook"
  | "gtm"
  | "ga4";

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  slug: string;
  subdomain: string | null;
  status: QuizStatus;
  settings: Record<string, unknown>;
  leadsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  orderIndex: number;
  label: string;
  value: string;
  variableValue: string | null;
  nextStep: OptionNextStep;
  nextQuestionId: string | null;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  orderIndex: number;
  type: QuestionType;
  title: string;
  description: string | null;
  variableName: string | null;
  isRequired: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  options: QuestionOption[];
}

export interface FinalPageBlock {
  id: string;
  quizId: string;
  type: FinalPageBlockType;
  orderIndex: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutConfig {
  id: string;
  quizId: string;
  provider: CheckoutProvider;
  checkoutUrl: string;
  urlTemplate: string;
  customParams: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const checkoutProviderTemplates: Record<CheckoutProvider, string> = {
  hotmart:
    "{url}?off_name={{name}}&off_email={{email}}&off_phone={{phone}}",
  kiwify:
    "{url}?customer_name={{name}}&customer_email={{email}}&customer_phone={{phone}}",
  eduzz: "{url}?name={{name}}&email={{email}}&phone_number={{phone}}",
  stripe: "{url}?prefilled_email={{email}}",
  custom: "{url}",
};

export interface PublicQuizOption {
  id: string;
  label: string;
  value: string;
  variableValue: string | null;
  nextStep: OptionNextStep;
  nextQuestionId: string | null;
}

export interface PublicQuizQuestion {
  id: string;
  orderIndex: number;
  type: QuestionType;
  title: string;
  description: string | null;
  variableName: string | null;
  isRequired: boolean;
  options: PublicQuizOption[];
}

export interface PublicQuiz {
  id: string;
  title: string;
  slug: string;
  settings: {
    primaryColor: string;
    backgroundColor: string;
    logoUrl: string | null;
    ctaText: string;
    ctaUrl: string | null;
    finalPageTitle: string;
    finalPageMessage: string;
  };
  questions: PublicQuizQuestion[];
  finalPageBlocks: FinalPageBlock[];
  tracking: {
    facebookPixelId: string | null;
    gtmId: string | null;
    ga4Id: string | null;
    scripts: {
      facebook: string | null;
      gtm: string | null;
      ga4: string | null;
    };
  };
}

export interface PublicAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
}

export interface PublicLeadSession {
  id: string;
  writeToken: string;
  existing: boolean;
}

export interface Lead {
  id: string;
  quizId: string;
  quizTitle: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  completed: boolean;
  ctaClicked: boolean;
  checkoutClicked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetail extends Lead {
  answers: Record<string, unknown>;
  answerDetails: LeadAnswerDetail[];
  variables: Record<string, unknown>;
  tags: string[];
  attribution: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    fbclid: string | null;
    gclid: string | null;
  };
  events: LeadEvent[];
  updatedAt: string;
}

export interface LeadAnswerDetail {
  questionId: string;
  questionTitle: string;
  answer: unknown;
  answerLabel: string;
}

export interface LeadEvent {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface LeadFilters {
  quizId?: string;
  startDate?: string;
  endDate?: string;
  completed?: boolean;
  hasEmail?: boolean;
  page?: number;
  perPage?: number;
}

export interface LeadListResponse {
  data: Lead[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  quizId?: string;
}

export interface AnalyticsSummaryTotals {
  visitors: number;
  starts: number;
  completions: number;
  completionRate: number;
  leads: number;
  ctaClicks: number;
  checkoutClicks: number;
}

export interface AnalyticsQuizSummary extends AnalyticsSummaryTotals {
  quizId: string;
  quizName: string;
}

export interface AnalyticsSummary {
  period: {
    startDate: string;
    endDate: string;
  };
  totals: AnalyticsSummaryTotals;
  quizzes: AnalyticsQuizSummary[];
}

export interface AnalyticsTimelinePoint {
  date: string;
  visitors: number;
  starts: number;
  completions: number;
  leads: number;
  checkoutClicks: number;
}

export interface AnalyticsFunnelStep {
  key: string;
  label: string;
  orderIndex: number;
  count: number;
}

export interface AnalyticsAnswerDistribution {
  questionId: string;
  questionTitle: string;
  total: number;
  options: Array<{
    label: string;
    value: string;
    count: number;
    percentage: number;
  }>;
}

export interface AnalyticsUtmDistribution {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  leads: number;
  conversions: number;
  conversionRate: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  plan: AuthUser["plan"];
  isActive: boolean;
  createdAt: string;
  quizzesCount: number;
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

export interface ClientDashboard {
  role: "client";
  summary: {
    quizzes: number;
    leads: number;
    completionRate: number;
    checkoutClicks: number;
  };
  recentQuizzes: Quiz[];
  recentLeads: Lead[];
}

export interface AdminDashboard {
  role: "admin";
  summary: {
    users: number;
    activeUsers: number;
    quizzes: number;
    leads: number;
  };
  recentQuizzes: Quiz[];
}

export type DashboardData = ClientDashboard | AdminDashboard;

export function getDashboardData(): Promise<DashboardData> {
  return authenticatedRequest<DashboardData>("/api/dashboard");
}

export function getPublicQuiz(slug: string): Promise<PublicQuiz> {
  return publicRequest<PublicQuiz>(`/api/public/quiz/${slug}`);
}

export function registerPublicQuizVisit(
  slug: string,
  attribution: PublicAttribution,
): Promise<{ registered: true }> {
  return publicRequest<{ registered: true }>(
    `/api/public/quiz/${slug}/visit`,
    {
      method: "POST",
      body: JSON.stringify({ attribution, website: "" }),
    },
  );
}

export function createPublicLead(input: {
  slug: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  answers: Record<string, string>;
  variables: Record<string, string>;
  attribution: PublicAttribution;
  website?: string;
}): Promise<PublicLeadSession> {
  return publicRequest<PublicLeadSession>("/api/public/leads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePublicLead(
  id: string,
  writeToken: string,
  input: {
    email?: string;
    name?: string | null;
    phone?: string | null;
    answers: Record<string, string>;
    variables: Record<string, string>;
    attribution: PublicAttribution;
    website?: string;
  },
): Promise<{ updated: true }> {
  return publicRequest<{ updated: true }>(`/api/public/leads/${id}`, {
    method: "PUT",
    headers: { "X-Lead-Token": writeToken },
    body: JSON.stringify(input),
  });
}

export function registerPublicLeadEvent(
  id: string,
  writeToken: string,
  type: "start" | "complete" | "cta_click" | "checkout_click",
  metadata: Record<string, unknown> = {},
): Promise<{ registered: true }> {
  return publicRequest<{ registered: true }>(
    `/api/public/leads/${id}/event`,
    {
      method: "POST",
      headers: { "X-Lead-Token": writeToken },
      body: JSON.stringify({ type, metadata, website: "" }),
    },
  );
}

export function getPublicCheckoutUrl(
  slug: string,
  leadId: string,
  writeToken: string,
  checkoutId?: string,
): Promise<{ url: string; checkoutId: string; provider: CheckoutProvider }> {
  const query = new URLSearchParams({ lead_id: leadId });

  if (checkoutId) {
    query.set("checkout_id", checkoutId);
  }

  return publicRequest<{
    url: string;
    checkoutId: string;
    provider: CheckoutProvider;
  }>(`/api/public/quiz/${slug}/checkout-url?${query.toString()}`, {
    headers: { "X-Lead-Token": writeToken },
  });
}

export function getQuizzes(filters?: {
  status?: QuizStatus;
  userId?: string;
}): Promise<Quiz[]> {
  return authenticatedRequest<Quiz[]>(
    `/api/quizzes${toQueryString(filters)}`,
  );
}

export function getQuiz(id: string): Promise<Quiz> {
  return authenticatedRequest<Quiz>(`/api/quizzes/${id}`);
}

export function getUserQuizzes(userId: string): Promise<Quiz[]> {
  return authenticatedRequest<Quiz[]>(
    `/api/admin/users/${userId}/quizzes`,
  );
}

export function createQuiz(input: { title: string }): Promise<Quiz> {
  return authenticatedRequest<Quiz>("/api/quizzes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateQuiz(
  id: string,
  input: Partial<{
    title: string;
    slug: string;
    status: QuizStatus;
    subdomain: string | null;
    settings: Record<string, unknown>;
  }>,
): Promise<Quiz> {
  return authenticatedRequest<Quiz>(`/api/quizzes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  return authenticatedRequest<QuizQuestion[]>(
    `/api/quizzes/${quizId}/questions`,
  );
}

export function createQuestion(
  quizId: string,
  input: Partial<{ title: string; type: QuestionType }> = {},
): Promise<QuizQuestion> {
  return authenticatedRequest<QuizQuestion>(
    `/api/quizzes/${quizId}/questions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateQuestion(
  quizId: string,
  questionId: string,
  input: Partial<{
    title: string;
    description: string | null;
    type: QuestionType;
    variableName: string | null;
    isRequired: boolean;
    settings: Record<string, unknown>;
  }>,
): Promise<QuizQuestion> {
  return authenticatedRequest<QuizQuestion>(
    `/api/quizzes/${quizId}/questions/${questionId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function deleteQuestion(
  quizId: string,
  questionId: string,
): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(
    `/api/quizzes/${quizId}/questions/${questionId}`,
    { method: "DELETE" },
  );
}

export function reorderQuestions(
  quizId: string,
  ids: string[],
): Promise<QuizQuestion[]> {
  return authenticatedRequest<QuizQuestion[]>(
    `/api/quizzes/${quizId}/questions/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ ids }),
    },
  );
}

export function createQuestionOption(
  questionId: string,
  input: Partial<{ label: string; value: string }> = {},
): Promise<QuestionOption> {
  return authenticatedRequest<QuestionOption>(
    `/api/questions/${questionId}/options`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateQuestionOption(
  questionId: string,
  optionId: string,
  input: Partial<{
    label: string;
    value: string;
    variableValue: string | null;
    nextStep: OptionNextStep;
    nextQuestionId: string | null;
  }>,
): Promise<QuestionOption> {
  return authenticatedRequest<QuestionOption>(
    `/api/questions/${questionId}/options/${optionId}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function deleteQuestionOption(
  questionId: string,
  optionId: string,
): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(
    `/api/questions/${questionId}/options/${optionId}`,
    { method: "DELETE" },
  );
}

export function reorderQuestionOptions(
  questionId: string,
  ids: string[],
): Promise<QuestionOption[]> {
  return authenticatedRequest<QuestionOption[]>(
    `/api/questions/${questionId}/options/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ ids }),
    },
  );
}

export async function uploadQuizLogo(
  quizId: string,
  file: File,
): Promise<Quiz> {
  const formData = new FormData();
  formData.append("logo", file);
  const response = await authenticatedFetch(`/api/quizzes/${quizId}/logo`, {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<Quiz>
    | null;
  const data = payload?.data;

  if (!response.ok || !payload?.success || data === undefined) {
    await throwApiError(response, payload);
  }

  return data as Quiz;
}

export function getFinalPageBlocks(
  quizId: string,
): Promise<FinalPageBlock[]> {
  return authenticatedRequest<FinalPageBlock[]>(
    `/api/quizzes/${quizId}/final-page`,
  );
}

export function createFinalPageBlock(
  quizId: string,
  input: { type: FinalPageBlockType; afterBlockId?: string },
): Promise<FinalPageBlock[]> {
  return authenticatedRequest<FinalPageBlock[]>(
    `/api/quizzes/${quizId}/final-page/blocks`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateFinalPageBlock(
  quizId: string,
  blockId: string,
  input: Partial<
    Pick<FinalPageBlock, "content" | "settings">
  >,
): Promise<FinalPageBlock> {
  return authenticatedRequest<FinalPageBlock>(
    `/api/quizzes/${quizId}/final-page/blocks/${blockId}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteFinalPageBlock(
  quizId: string,
  blockId: string,
): Promise<FinalPageBlock[]> {
  return authenticatedRequest<FinalPageBlock[]>(
    `/api/quizzes/${quizId}/final-page/blocks/${blockId}`,
    { method: "DELETE" },
  );
}

export function reorderFinalPageBlocks(
  quizId: string,
  ids: string[],
): Promise<FinalPageBlock[]> {
  return authenticatedRequest<FinalPageBlock[]>(
    `/api/quizzes/${quizId}/final-page/blocks/reorder`,
    { method: "PUT", body: JSON.stringify({ ids }) },
  );
}

export async function uploadFinalPageImage(
  quizId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const formData = new FormData();
  formData.append("image", file);
  const response = await authenticatedFetch(
    `/api/quizzes/${quizId}/final-page/images`,
    { method: "POST", body: formData },
  );
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<{ url: string; path: string }>
    | null;
  const data = payload?.data;

  if (!response.ok || !payload?.success || !data) {
    await throwApiError(response, payload);
  }

  return data as { url: string; path: string };
}

export function getCheckoutConfigs(
  quizId: string,
): Promise<CheckoutConfig[]> {
  return authenticatedRequest<CheckoutConfig[]>(
    `/api/quizzes/${quizId}/checkout`,
  );
}

export function createCheckoutConfig(
  quizId: string,
  input: {
    provider: CheckoutProvider;
    checkoutUrl: string;
    urlTemplate?: string;
    customParams?: Record<string, string>;
    isActive?: boolean;
  },
): Promise<CheckoutConfig> {
  return authenticatedRequest<CheckoutConfig>(
    `/api/quizzes/${quizId}/checkout`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateCheckoutConfig(
  quizId: string,
  checkoutId: string,
  input: Partial<{
    provider: CheckoutProvider;
    checkoutUrl: string;
    urlTemplate: string;
    customParams: Record<string, string>;
    isActive: boolean;
  }>,
): Promise<CheckoutConfig> {
  return authenticatedRequest<CheckoutConfig>(
    `/api/quizzes/${quizId}/checkout/${checkoutId}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteCheckoutConfig(
  quizId: string,
  checkoutId: string,
): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(
    `/api/quizzes/${quizId}/checkout/${checkoutId}`,
    { method: "DELETE" },
  );
}

export function deleteQuiz(id: string): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(`/api/quizzes/${id}`, {
    method: "DELETE",
  });
}

export function duplicateQuiz(id: string): Promise<Quiz> {
  return authenticatedRequest<Quiz>(`/api/quizzes/${id}/duplicate`, {
    method: "POST",
  });
}

export function getAnalyticsSummary(
  filters?: AnalyticsFilters,
): Promise<AnalyticsSummary> {
  return authenticatedRequest<AnalyticsSummary>(
    `/api/analytics/summary${toQueryString(analyticsFiltersToQuery(filters))}`,
  );
}

export function getAnalyticsTimeline(
  filters?: AnalyticsFilters,
): Promise<AnalyticsTimelinePoint[]> {
  return authenticatedRequest<AnalyticsTimelinePoint[]>(
    `/api/analytics/timeline${toQueryString(analyticsFiltersToQuery(filters))}`,
  );
}

export function getQuizAnalyticsSummary(
  quizId: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsQuizSummary> {
  return authenticatedRequest<AnalyticsQuizSummary>(
    `/api/analytics/${quizId}/summary${toQueryString(
      analyticsFiltersToQuery(filters),
    )}`,
  );
}

export function getQuizAnalyticsTimeline(
  quizId: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsTimelinePoint[]> {
  return authenticatedRequest<AnalyticsTimelinePoint[]>(
    `/api/analytics/${quizId}/timeline${toQueryString(
      analyticsFiltersToQuery(filters),
    )}`,
  );
}

export function getQuizAnalyticsFunnel(
  quizId: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsFunnelStep[]> {
  return authenticatedRequest<AnalyticsFunnelStep[]>(
    `/api/analytics/${quizId}/funnel${toQueryString(
      analyticsFiltersToQuery(filters),
    )}`,
  );
}

export function getQuizAnalyticsAnswers(
  quizId: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsAnswerDistribution[]> {
  return authenticatedRequest<AnalyticsAnswerDistribution[]>(
    `/api/analytics/${quizId}/answers${toQueryString(
      analyticsFiltersToQuery(filters),
    )}`,
  );
}

export function getQuizAnalyticsUtm(
  quizId: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsUtmDistribution[]> {
  return authenticatedRequest<AnalyticsUtmDistribution[]>(
    `/api/analytics/${quizId}/utm${toQueryString(
      analyticsFiltersToQuery(filters),
    )}`,
  );
}

export function getLeads(filters?: LeadFilters): Promise<LeadListResponse> {
  return authenticatedRequest<LeadListResponse>(
    `/api/leads${toQueryString(leadFiltersToQuery(filters))}`,
  );
}

export function getLead(id: string): Promise<LeadDetail> {
  return authenticatedRequest<LeadDetail>(`/api/leads/${id}`);
}

export async function downloadLeadsCsv(filters?: LeadFilters): Promise<void> {
  const response = await authenticatedFetch(
    `/api/leads/export/csv${toQueryString(leadFiltersToQuery(filters))}`,
  );

  if (!response.ok) {
    await throwApiError(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const fileName =
    disposition?.match(/filename="([^"]+)"/)?.[1] ?? "leads-split-master.csv";
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function getAdminUsers(filters?: {
  plan?: AuthUser["plan"];
  status?: "active" | "inactive";
}): Promise<AdminUser[]> {
  return authenticatedRequest<AdminUser[]>(
    `/api/admin/users${toQueryString(filters)}`,
  );
}

export function updateAdminUser(
  id: string,
  input: Partial<{
    plan: AuthUser["plan"];
    isActive: boolean;
  }>,
): Promise<AdminUser> {
  return authenticatedRequest<AdminUser>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getIntegrations(quizId?: string): Promise<Integration[]> {
  return authenticatedRequest<Integration[]>(
    `/api/integrations${toQueryString({ quizId })}`,
  );
}

export function saveIntegration(input: {
  quizId: string;
  type: IntegrationType;
  settings: Record<string, unknown>;
  isActive?: boolean;
}): Promise<Integration> {
  return authenticatedRequest<Integration>("/api/integrations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteIntegration(id: string): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(`/api/integrations/${id}`, {
    method: "DELETE",
  });
}

export function testActiveCampaign(input: {
  quizId?: string;
  apiUrl?: string;
  apiKey?: string;
}): Promise<{
  connected: true;
  lists: ActiveCampaignList[];
  tags: ActiveCampaignTag[];
  fields: ActiveCampaignField[];
}> {
  return authenticatedRequest<{
    connected: true;
    lists: ActiveCampaignList[];
    tags: ActiveCampaignTag[];
    fields: ActiveCampaignField[];
  }>("/api/integrations/activecampaign/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getActiveCampaignLists(input: {
  quizId?: string;
  apiUrl?: string;
  apiKey?: string;
}): Promise<ActiveCampaignList[]> {
  return authenticatedRequest<ActiveCampaignList[]>(
    `/api/integrations/activecampaign/lists${toQueryString({
      quizId: input.quizId,
    })}`,
    { headers: activeCampaignHeaders(input) },
  );
}

export function getActiveCampaignTags(input: {
  quizId?: string;
  apiUrl?: string;
  apiKey?: string;
}): Promise<ActiveCampaignTag[]> {
  return authenticatedRequest<ActiveCampaignTag[]>(
    `/api/integrations/activecampaign/tags${toQueryString({
      quizId: input.quizId,
    })}`,
    { headers: activeCampaignHeaders(input) },
  );
}

export function getActiveCampaignFields(input: {
  quizId?: string;
  apiUrl?: string;
  apiKey?: string;
}): Promise<ActiveCampaignField[]> {
  return authenticatedRequest<ActiveCampaignField[]>(
    `/api/integrations/activecampaign/fields${toQueryString({
      quizId: input.quizId,
    })}`,
    { headers: activeCampaignHeaders(input) },
  );
}

export function testWebhook(input: {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
}): Promise<{ delivered: true; status: number }> {
  return authenticatedRequest<{ delivered: true; status: number }>(
    "/api/integrations/webhook/test",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateProfile(input: {
  name: string;
  email: string;
}): Promise<AuthUser> {
  return authenticatedRequest<AuthUser>("/api/account/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ updated: true }> {
  return authenticatedRequest<{ updated: true }>("/api/account/password", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authenticatedRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | null;

  if (!response.ok || !payload?.success || payload.data === undefined) {
    if (response.status === 401) {
      clearToken();
    }

    throw new ApiError(
      payload?.error ?? "O servidor retornou uma resposta inesperada.",
      response.status,
    );
  }

  return payload.data;
}

async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getStoredToken();

  if (!token) {
    throw new ApiError("Sua sessão não foi encontrada.", 401);
  }

  try {
    const isFormData =
      typeof FormData !== "undefined" && init.body instanceof FormData;

    return await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao servidor. Tente novamente em instantes.",
      0,
    );
  }
}

async function throwApiError(
  response: Response,
  knownPayload?: ApiResponse<unknown> | null,
): Promise<never> {
  const payload =
    knownPayload ??
    ((await response.json().catch(() => null)) as ApiResponse<unknown> | null);

  if (response.status === 401) {
    clearToken();
  }

  throw new ApiError(
    payload?.error ?? "Não foi possível concluir a operação.",
    response.status,
  );
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor. Tente novamente em instantes.",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | null;

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(
      payload?.error ?? "O servidor retornou uma resposta inesperada.",
    );
  }

  return payload.data;
}

async function publicRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao servidor. Tente novamente em instantes.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | null;

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new ApiError(
      payload?.error ?? "Não foi possível concluir a operação.",
      response.status,
    );
  }

  return payload.data;
}

function toQueryString(
  values:
    | Record<string, string | number | boolean | null | undefined>
    | undefined,
): string {
  if (!values) {
    return "";
  }

  const searchParams = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function analyticsFiltersToQuery(filters?: AnalyticsFilters) {
  return {
    start_date: filters?.startDate,
    end_date: filters?.endDate,
    quiz_id: filters?.quizId,
  };
}

function leadFiltersToQuery(filters?: LeadFilters) {
  return {
    quiz_id: filters?.quizId,
    start_date: filters?.startDate,
    end_date: filters?.endDate,
    completed: filters?.completed,
    has_email: filters?.hasEmail,
    page: filters?.page,
    per_page: filters?.perPage,
  };
}

function activeCampaignHeaders(input: {
  apiUrl?: string;
  apiKey?: string;
}): HeadersInit {
  return {
    ...(input.apiUrl ? { "X-ActiveCampaign-Api-Url": input.apiUrl } : {}),
    ...(input.apiKey ? { "X-ActiveCampaign-Api-Key": input.apiKey } : {}),
  };
}
