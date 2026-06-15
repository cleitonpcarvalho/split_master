import { extname } from "node:path";

import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import {
  type FinalPageBlock,
  type FinalPageBlockRow,
  type FinalPageBlockType,
} from "../models/final-page.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import { findAccessibleQuiz } from "./quiz.service.js";

interface BlockUpdateInput {
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

const blockColumns =
  "id,quiz_id,type,order_index,content,settings,created_at,updated_at";

export async function listFinalPageBlocks(
  user: AuthenticatedRequestUser,
  quizId: string,
): Promise<FinalPageBlock[]> {
  await findAccessibleQuiz(user, quizId);
  return listBlocksByQuizId(quizId);
}

export async function listPublicFinalPageBlocks(
  quizId: string,
): Promise<FinalPageBlock[]> {
  return listBlocksByQuizId(quizId);
}

export async function createFinalPageBlock(
  user: AuthenticatedRequestUser,
  quizId: string,
  type: FinalPageBlockType,
  afterBlockId?: string,
): Promise<FinalPageBlock[]> {
  await findAccessibleQuiz(user, quizId);
  const blocks = await listBlocksByQuizId(quizId);
  const insertionIndex = afterBlockId
    ? Math.max(
        blocks.findIndex((block) => block.id === afterBlockId) + 1,
        0,
      )
    : blocks.length;
  const temporaryOrder = blocks.length;
  const defaults = getBlockDefaults(type);
  const { data, error } = await supabaseAdmin
    .from("final_page_blocks")
    .insert({
      quiz_id: quizId,
      type,
      order_index: temporaryOrder,
      content: defaults.content,
      settings: defaults.settings,
    })
    .select(blockColumns)
    .single<FinalPageBlockRow>();

  if (error) {
    throw new AppError(`Não foi possível criar o bloco: ${error.message}`);
  }

  const nextIds = blocks.map((block) => block.id);
  nextIds.splice(insertionIndex, 0, data.id);
  return reorderFinalPageBlocks(user, quizId, nextIds);
}

export async function updateFinalPageBlock(
  user: AuthenticatedRequestUser,
  quizId: string,
  blockId: string,
  input: BlockUpdateInput,
): Promise<FinalPageBlock> {
  await findAccessibleQuiz(user, quizId);
  await findBlock(quizId, blockId);
  const update: Record<string, unknown> = {};

  if (input.content !== undefined) {
    update.content = input.content;
  }
  if (input.settings !== undefined) {
    update.settings = input.settings;
  }

  const { data, error } = await supabaseAdmin
    .from("final_page_blocks")
    .update(update)
    .eq("id", blockId)
    .eq("quiz_id", quizId)
    .select(blockColumns)
    .single<FinalPageBlockRow>();

  if (error) {
    throw new AppError(`Não foi possível atualizar o bloco: ${error.message}`);
  }

  return mapBlock(data);
}

export async function deleteFinalPageBlock(
  user: AuthenticatedRequestUser,
  quizId: string,
  blockId: string,
): Promise<FinalPageBlock[]> {
  await findAccessibleQuiz(user, quizId);
  await findBlock(quizId, blockId);
  const { error } = await supabaseAdmin
    .from("final_page_blocks")
    .delete()
    .eq("id", blockId)
    .eq("quiz_id", quizId);

  if (error) {
    throw new AppError(`Não foi possível excluir o bloco: ${error.message}`);
  }

  const remaining = await listBlocksByQuizId(quizId);
  return reorderFinalPageBlocks(
    user,
    quizId,
    remaining.map((block) => block.id),
  );
}

export async function reorderFinalPageBlocks(
  user: AuthenticatedRequestUser,
  quizId: string,
  ids: string[],
): Promise<FinalPageBlock[]> {
  await findAccessibleQuiz(user, quizId);

  if (new Set(ids).size !== ids.length) {
    throw new AppError("A ordenação contém blocos repetidos.", 400);
  }

  const { error } = await supabaseAdmin.rpc("reorder_final_page_blocks", {
    target_quiz_id: quizId,
    ordered_ids: ids,
  });

  if (error) {
    throw new AppError(`Não foi possível reordenar os blocos: ${error.message}`);
  }

  return listBlocksByQuizId(quizId);
}

export async function uploadFinalPageImage(
  user: AuthenticatedRequestUser,
  quizId: string,
  file: Express.Multer.File,
): Promise<{ url: string; path: string }> {
  const quiz = await findAccessibleQuiz(user, quizId);
  const extension = getSafeExtension(file);
  const path = `${quiz.user_id}/${quiz.id}/final-page-${Date.now()}${extension}`;
  const bucket = supabaseAdmin.storage.from(env.supabaseStorageBucket);
  const { error } = await bucket.upload(path, file.buffer, {
    contentType: file.mimetype,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new AppError(`Não foi possível enviar a imagem: ${error.message}`);
  }

  return {
    path,
    url: bucket.getPublicUrl(path).data.publicUrl,
  };
}

async function listBlocksByQuizId(quizId: string): Promise<FinalPageBlock[]> {
  const { data, error } = await supabaseAdmin
    .from("final_page_blocks")
    .select(blockColumns)
    .eq("quiz_id", quizId)
    .order("order_index")
    .returns<FinalPageBlockRow[]>();

  if (error) {
    throw new AppError(`Não foi possível listar os blocos: ${error.message}`);
  }

  return data.map(mapBlock);
}

async function findBlock(
  quizId: string,
  blockId: string,
): Promise<FinalPageBlockRow> {
  const { data, error } = await supabaseAdmin
    .from("final_page_blocks")
    .select(blockColumns)
    .eq("id", blockId)
    .eq("quiz_id", quizId)
    .maybeSingle<FinalPageBlockRow>();

  if (error) {
    throw new AppError(`Não foi possível buscar o bloco: ${error.message}`);
  }
  if (!data) {
    throw new AppError("Bloco não encontrado.", 404);
  }

  return data;
}

function getBlockDefaults(type: FinalPageBlockType): {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
} {
  const defaults: Record<
    FinalPageBlockType,
    { content: Record<string, unknown>; settings: Record<string, unknown> }
  > = {
    title: {
      content: { text: "Olá {{name}}, temos uma recomendação para você!" },
      settings: { align: "center", color: "#0F1F3D" },
    },
    subtitle: {
      content: { text: "Com base nas suas respostas, este é o próximo passo." },
      settings: { align: "center", color: "#0F1F3D" },
    },
    paragraph: {
      content: { text: "Explique aqui por que esta oferta combina com o lead." },
      settings: { align: "left", color: "#334155" },
    },
    image: {
      content: { url: "", alt: "" },
      settings: { width: "full", radius: 16 },
    },
    video: {
      content: { url: "" },
      settings: { ratio: "16/9" },
    },
    bullets: {
      content: { items: ["Benefício principal", "Próximo resultado esperado"] },
      settings: { color: "#0F1F3D" },
    },
    testimonial: {
      content: {
        photoUrl: "",
        name: "Nome do cliente",
        role: "Cliente",
        text: "Conte aqui uma experiência real com a oferta.",
      },
      settings: { backgroundColor: "#F8FAFC" },
    },
    cta_button: {
      content: { text: "Quero saber mais", url: "https://" },
      settings: { color: "#00C48C", textColor: "#0F1F3D" },
    },
    checkout_button: {
      content: { text: "Ir para o checkout", checkoutId: null },
      settings: { color: "#00C48C", textColor: "#0F1F3D" },
    },
    divider: {
      content: {},
      settings: { color: "#E2E8F0", thickness: 1 },
    },
    spacer: {
      content: {},
      settings: { height: 32 },
    },
  };

  return defaults[type];
}

function getSafeExtension(file: Express.Multer.File): string {
  const byMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };

  return byMime[file.mimetype] ?? extname(file.originalname).toLowerCase();
}

function mapBlock(row: FinalPageBlockRow): FinalPageBlock {
  return {
    id: row.id,
    quizId: row.quiz_id,
    type: row.type,
    orderIndex: row.order_index,
    content: row.content,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
