export interface LeadSummary {
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

export interface LeadDetail extends LeadSummary {
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

export interface LeadPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface LeadListResponse {
  data: LeadSummary[];
  pagination: LeadPagination;
}
