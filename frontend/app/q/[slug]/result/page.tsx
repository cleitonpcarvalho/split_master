"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FinalPageRenderer } from "@/components/final-page/FinalPageRenderer";
import { TrackingScripts } from "@/components/public/TrackingScripts";
import {
  ApiError,
  type FinalPageBlock,
  type PublicLeadSession,
  type PublicQuiz,
  getPublicCheckoutUrl,
  getPublicQuiz,
  registerPublicLeadEvent,
} from "@/lib/api";
import { trackCheckoutPurchase } from "@/lib/tracking";

interface QuizResultBackup {
  variables?: Record<string, string>;
  lead?: PublicLeadSession | null;
  finished?: boolean;
}

export default function PublicQuizResultPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [lead, setLead] = useState<PublicLeadSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const backup = readBackup(slug);
    setVariables(backup.variables ?? {});
    setLead(backup.lead ?? null);

    getPublicQuiz(slug)
      .then(setQuiz)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
          return;
        }

        toast.error(getErrorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const blocks = useMemo(
    () => (quiz ? getResultBlocks(quiz) : []),
    [quiz],
  );

  async function handleCtaClick(url: string, block: FinalPageBlock) {
    const popup = window.open("", "_blank");

    if (lead) {
      try {
        await registerPublicLeadEvent(
          lead.id,
          lead.writeToken,
          "cta_click",
          { blockId: block.id },
        );
      } catch {
        // A oferta continua acessível mesmo quando o tracking está indisponível.
      }
    }

    if (popup) {
      popup.opener = null;
      popup.location.href = url;
    } else {
      window.location.assign(url);
    }
  }

  async function handleCheckoutClick(
    checkoutId: string | undefined,
    block: FinalPageBlock,
  ) {
    if (!lead) {
      toast.error(
        "Não encontramos os dados desta resposta. Refaça o quiz para preencher o checkout.",
      );
      return;
    }

    // A aba nasce no clique para não ser bloqueada enquanto a URL é montada.
    const popup = window.open("", "_blank");

    try {
      const checkout = await getPublicCheckoutUrl(
        slug,
        lead.id,
        lead.writeToken,
        checkoutId,
      );
      trackCheckoutPurchase({
        checkout_id: checkout.checkoutId,
        provider: checkout.provider,
      });
      await registerPublicLeadEvent(
        lead.id,
        lead.writeToken,
        "checkout_click",
        {
          blockId: block.id,
          checkoutId: checkout.checkoutId,
          provider: checkout.provider,
        },
      ).catch(() => {
        // Uma falha de analytics não deve bloquear a compra.
      });

      if (popup) {
        popup.opener = null;
        popup.location.href = checkout.url;
      } else {
        window.location.assign(checkout.url);
      }
    } catch (error) {
      popup?.close();
      toast.error(getErrorMessage(error));
    }
  }

  function restart() {
    localStorage.removeItem(getBackupKey(slug));
    router.push(`/q/${slug}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <LoaderCircle className="h-10 w-10 animate-spin text-green" />
      </main>
    );
  }

  if (notFound || !quiz) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-5 text-center">
        <div>
          <h1 className="text-3xl font-black text-navy">
            Esta página não está disponível
          </h1>
          <p className="mt-3 text-sm text-navy/45">
            Confira o link ou tente novamente mais tarde.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6 sm:py-16"
      style={{ backgroundColor: quiz.settings.backgroundColor }}
    >
      <TrackingScripts tracking={quiz.tracking} />

      <FinalPageRenderer
        blocks={blocks}
        variables={variables}
        primaryColor={quiz.settings.primaryColor}
        backgroundColor={quiz.settings.backgroundColor}
        logoUrl={quiz.settings.logoUrl}
        quizTitle={quiz.title}
        onCtaClick={(url, block) => void handleCtaClick(url, block)}
        onCheckoutClick={(checkoutId, block) =>
          void handleCheckoutClick(checkoutId, block)
        }
      />

      <button
        type="button"
        onClick={restart}
        className="mx-auto mt-12 flex items-center gap-2 text-xs font-bold text-navy/30 transition hover:text-navy"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Responder novamente
      </button>
    </main>
  );
}

function getResultBlocks(quiz: PublicQuiz): FinalPageBlock[] {
  if (quiz.finalPageBlocks.length > 0) {
    return quiz.finalPageBlocks;
  }

  const now = new Date(0).toISOString();

  return [
    {
      id: "legacy-title",
      quizId: quiz.id,
      type: "title",
      orderIndex: 0,
      content: { text: quiz.settings.finalPageTitle },
      settings: { align: "center", color: "#0F1F3D" },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "legacy-message",
      quizId: quiz.id,
      type: "paragraph",
      orderIndex: 1,
      content: { text: quiz.settings.finalPageMessage },
      settings: { align: "center", color: "#334155" },
      createdAt: now,
      updatedAt: now,
    },
    ...(quiz.settings.ctaUrl
      ? [
          {
            id: "legacy-cta",
            quizId: quiz.id,
            type: "cta_button" as const,
            orderIndex: 2,
            content: {
              text: quiz.settings.ctaText,
              url: quiz.settings.ctaUrl,
            },
            settings: {
              align: "center",
              color: quiz.settings.primaryColor,
              textColor: "#0F1F3D",
            },
            createdAt: now,
            updatedAt: now,
          },
        ]
      : []),
  ];
}

function readBackup(slug: string): QuizResultBackup {
  try {
    const value = localStorage.getItem(getBackupKey(slug));
    return value ? (JSON.parse(value) as QuizResultBackup) : {};
  } catch {
    return {};
  }
}

function getBackupKey(slug: string): string {
  return `split-master:quiz-progress:${slug}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
