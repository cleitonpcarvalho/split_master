export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
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
  period: AnalyticsPeriod;
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

export interface AnalyticsAnswerOption {
  label: string;
  value: string;
  count: number;
  percentage: number;
}

export interface AnalyticsAnswerDistribution {
  questionId: string;
  questionTitle: string;
  total: number;
  options: AnalyticsAnswerOption[];
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

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  quizId?: string;
}
