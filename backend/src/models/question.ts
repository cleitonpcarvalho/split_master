export const questionTypes = [
  "multiple_choice",
  "text",
  "name",
  "email",
  "phone",
  "number",
] as const;

export const optionNextSteps = ["default", "question", "final"] as const;

export type QuestionType = (typeof questionTypes)[number];
export type OptionNextStep = (typeof optionNextSteps)[number];

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  order_index: number;
  label: string;
  value: string;
  variable_value: string | null;
  next_step: OptionNextStep;
  next_question_id: string | null;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  quiz_id: string;
  order_index: number;
  type: QuestionType;
  title: string;
  description: string | null;
  variable_name: string | null;
  is_required: boolean;
  settings: Record<string, unknown>;
  created_at: string;
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
