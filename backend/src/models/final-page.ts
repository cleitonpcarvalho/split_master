export const finalPageBlockTypes = [
  "title",
  "subtitle",
  "paragraph",
  "image",
  "video",
  "bullets",
  "testimonial",
  "cta_button",
  "checkout_button",
  "divider",
  "spacer",
] as const;

export type FinalPageBlockType = (typeof finalPageBlockTypes)[number];

export interface FinalPageBlockRow {
  id: string;
  quiz_id: string;
  type: FinalPageBlockType;
  order_index: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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
