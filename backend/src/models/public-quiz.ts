import type {
  OptionNextStep,
  QuestionType,
} from "./question.js";
import type { FinalPageBlock } from "./final-page.js";
import type { PublicTrackingSettings } from "./integration.js";

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

export interface PublicQuizSettings {
  primaryColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  ctaText: string;
  ctaUrl: string | null;
  finalPageTitle: string;
  finalPageMessage: string;
}

export interface PublicQuiz {
  id: string;
  title: string;
  slug: string;
  settings: PublicQuizSettings;
  questions: PublicQuizQuestion[];
  finalPageBlocks: FinalPageBlock[];
  tracking: PublicTrackingSettings;
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
