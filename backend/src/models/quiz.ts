export const quizStatuses = ["draft", "active", "inactive"] as const;

export type QuizStatus = (typeof quizStatuses)[number];

export interface QuizRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  subdomain: string | null;
  status: QuizStatus;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QuizSummary {
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
