"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type QuestionOption,
  type Quiz,
  type QuizQuestion,
  getQuiz,
  getQuizQuestions,
} from "@/lib/api";

export default function QuizPreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getQuiz(params.id), getQuizQuestions(params.id)])
      .then(([quizData, questionData]) => {
        setQuiz(quizData);
        setQuestions(questionData);
        setCurrentId(questionData[0]?.id ?? null);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Não foi possível abrir o preview.",
        ),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  const currentQuestion = useMemo(
    () => questions.find((question) => question.id === currentId) ?? null,
    [currentId, questions],
  );
  const currentIndex = currentQuestion
    ? questions.findIndex((question) => question.id === currentQuestion.id)
    : -1;

  function follow(option?: QuestionOption) {
    if (option?.nextStep === "final") {
      setFinished(true);
      return;
    }

    if (option?.nextStep === "question" && option.nextQuestionId) {
      setCurrentId(option.nextQuestionId);
      setAnswer("");
      return;
    }

    const next = questions[currentIndex + 1];

    if (next) {
      setCurrentId(next.id);
      setAnswer("");
    } else {
      setFinished(true);
    }
  }

  function restart() {
    setCurrentId(questions[0]?.id ?? null);
    setAnswer("");
    setFinished(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <LoaderCircle className="h-9 w-9 animate-spin text-green" />
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  const primaryColor = getSetting(quiz.settings, "primaryColor", "#00C48C");
  const backgroundColor = getSetting(
    quiz.settings,
    "backgroundColor",
    "#FFFFFF",
  );
  const logoUrl = getSetting(quiz.settings, "logoUrl", "");

  return (
    <main
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10"
      style={{ backgroundColor }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/quizzes/${quiz.id}/edit`)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-navy/10 bg-white px-4 text-sm font-bold text-navy shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao editor
          </button>
          <span className="rounded-full bg-navy px-3 py-1.5 text-xs font-extrabold text-white">
            Modo preview
          </span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-navy/5 bg-white shadow-xl shadow-navy/10">
          <div className="border-b border-navy/5 px-6 py-5 sm:px-10">
            <div className="flex items-center justify-between gap-4">
              {logoUrl ? (
                <div
                  className="h-12 w-36 bg-contain bg-left bg-no-repeat"
                  style={{ backgroundImage: `url("${logoUrl}")` }}
                  aria-label={quiz.title}
                />
              ) : (
                <h1 className="font-black text-navy">{quiz.title}</h1>
              )}
              {!finished && questions.length > 0 && (
                <span className="text-xs font-bold text-navy/40">
                  {Math.max(currentIndex + 1, 1)} de {questions.length}
                </span>
              )}
            </div>
            {!finished && questions.length > 0 && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-navy/5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </div>
            )}
          </div>

          <div className="min-h-[460px] px-6 py-10 sm:px-10 sm:py-14">
            {finished || !currentQuestion ? (
              <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
                <CheckCircle2
                  className="h-14 w-14"
                  style={{ color: primaryColor }}
                />
                <h2 className="mt-5 text-3xl font-black text-navy">
                  Tudo pronto!
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-navy/55">
                  Esta é a página final provisória do quiz. A personalização
                  completa será conectada à etapa de resultados.
                </p>
                <button
                  type="button"
                  onClick={restart}
                  className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-extrabold text-navy"
                  style={{ backgroundColor: primaryColor }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Testar novamente
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-navy/35">
                  Pergunta {currentIndex + 1}
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight text-navy sm:text-3xl">
                  {currentQuestion.title}
                </h2>
                {currentQuestion.description && (
                  <p className="mt-3 text-sm leading-6 text-navy/55">
                    {currentQuestion.description}
                  </p>
                )}

                {currentQuestion.type === "multiple_choice" ? (
                  <div className="mt-8 space-y-3">
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => follow(option)}
                        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-navy/10 px-5 text-left text-sm font-bold text-navy transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        {option.label}
                        <ArrowRight className="h-4 w-4 text-navy/30" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8">
                    <input
                      type={getInputType(currentQuestion.type)}
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Digite sua resposta"
                      className="min-h-14 w-full rounded-2xl border border-navy/10 px-5 text-base font-semibold text-navy outline-none focus:ring-2"
                      style={{ borderColor: answer ? primaryColor : undefined }}
                    />
                    <button
                      type="button"
                      onClick={() => follow()}
                      disabled={currentQuestion.isRequired && !answer.trim()}
                      className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-sm font-extrabold text-navy disabled:opacity-40"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getInputType(type: QuizQuestion["type"]): string {
  if (type === "email") {
    return "email";
  }
  if (type === "phone") {
    return "tel";
  }
  if (type === "number") {
    return "number";
  }

  return "text";
}

function getSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof settings[key] === "string" ? settings[key] : fallback;
}
