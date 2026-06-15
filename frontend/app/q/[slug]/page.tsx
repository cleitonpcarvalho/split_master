"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { TrackingScripts } from "@/components/public/TrackingScripts";
import {
  ApiError,
  type PublicAttribution,
  type PublicLeadSession,
  type PublicQuiz,
  type PublicQuizOption,
  type PublicQuizQuestion,
  createPublicLead,
  getPublicQuiz,
  registerPublicLeadEvent,
  registerPublicQuizVisit,
  updatePublicLead,
} from "@/lib/api";
import { trackLeadCaptured } from "@/lib/tracking";

interface QuizBackup {
  answers: Record<string, string>;
  variables: Record<string, string>;
  currentId: string | null;
  history: string[];
  lead: PublicLeadSession | null;
  started: boolean;
  startTracked: boolean;
  finished: boolean;
  completeTracked: boolean;
}

const emptyBackup: QuizBackup = {
  answers: {},
  variables: {},
  currentId: null,
  history: [],
  lead: null,
  started: false,
  startTracked: false,
  finished: false,
  completeTracked: false,
};

export default function PublicQuizPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [lead, setLead] = useState<PublicLeadSession | null>(null);
  const [started, setStarted] = useState(false);
  const [startTracked, setStartTracked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completeTracked, setCompleteTracked] = useState(false);
  const [attribution, setAttribution] = useState<PublicAttribution>({});
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const visitRegistered = useRef(false);
  const restored = useRef(false);

  useEffect(() => {
    const capturedAttribution = captureAttribution(slug);
    setAttribution(capturedAttribution);

    getPublicQuiz(slug)
      .then((data) => {
        setQuiz(data);

        // O backup local permite retomar o fluxo mesmo após fechar a aba.
        const backup = readBackup(slug);
        const validCurrentId = data.questions.some(
          (question) => question.id === backup.currentId,
        )
          ? backup.currentId
          : (data.questions[0]?.id ?? null);
        setAnswers(backup.answers);
        setVariables(backup.variables);
        setCurrentId(validCurrentId);
        setHistory(
          backup.history.filter((id) =>
            data.questions.some((question) => question.id === id),
          ),
        );
        setLead(backup.lead);
        setStarted(backup.started);
        setStartTracked(backup.startTracked);
        setFinished(backup.finished);
        setCompleteTracked(backup.completeTracked);
        restored.current = true;

        if (backup.finished) {
          window.location.replace(`/q/${slug}/result`);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
          return;
        }

        toast.error(getErrorMessage(error));
      })
      .finally(() => setLoading(false));

    if (!visitRegistered.current) {
      visitRegistered.current = true;
      registerPublicQuizVisit(slug, capturedAttribution).catch(() => {
        // A falha de tracking não impede o visitante de responder.
      });
    }
  }, [slug]);

  useEffect(() => {
    if (!restored.current || !quiz) {
      return;
    }

    writeBackup(slug, {
      answers,
      variables,
      currentId,
      history,
      lead,
      started,
      startTracked,
      finished,
      completeTracked,
    });
  }, [
    answers,
    completeTracked,
    currentId,
    finished,
    history,
    lead,
    quiz,
    slug,
    startTracked,
    started,
    variables,
  ]);

  const currentQuestion = useMemo(
    () =>
      quiz?.questions.find((question) => question.id === currentId) ?? null,
    [currentId, quiz],
  );
  const progress = useMemo(() => {
    if (!quiz || quiz.questions.length === 0) {
      return 0;
    }

    const answered = quiz.questions.filter((question) =>
      isAnswered(answers[question.id]),
    ).length;
    return Math.round((answered / quiz.questions.length) * 100);
  }, [answers, quiz]);

  async function answerQuestion(
    question: PublicQuizQuestion,
    value: string,
    option?: PublicQuizOption,
  ) {
    if (question.isRequired && !value.trim()) {
      toast.error("Responda esta pergunta para continuar.");
      return;
    }
    if (question.type === "email" && !isValidEmail(value)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (question.type === "email" && isObviouslyFakeEmail(value)) {
      toast.error("Informe um e-mail válido para continuar.");
      return;
    }

    setSubmitting(true);

    if (option) {
      setSelectedOptionId(option.id);
      await wait(160);
    }

    const nextAnswers = { ...answers, [question.id]: value.trim() };
    const variableName = getVariableName(question);
    const variableValue = option?.variableValue || value.trim();
    const nextVariables = variableName
      ? { ...variables, [variableName]: variableValue }
      : variables;
    const firstAnswer = !started;
    let activeLead = lead;

    setAnswers(nextAnswers);
    setVariables(nextVariables);
    setStarted(true);

    try {
      // O lead nasce no instante em que o e-mail é capturado.
      if (question.type === "email" && !activeLead) {
        activeLead = await createPublicLead({
          slug,
          email: value,
          ...getContactData(nextVariables),
          answers: nextAnswers,
          variables: nextVariables,
          attribution,
          website: honeypot,
        });
        setLead(activeLead);
        trackLeadCaptured();
      } else if (activeLead) {
        await updatePublicLead(activeLead.id, activeLead.writeToken, {
          email: nextVariables.email,
          ...getContactData(nextVariables),
          answers: nextAnswers,
          variables: nextVariables,
          attribution,
          website: honeypot,
        });
      }

      if (activeLead && (!startTracked || firstAnswer)) {
        await registerPublicLeadEvent(
          activeLead.id,
          activeLead.writeToken,
          "start",
          { firstQuestionId: question.id },
        );
        setStartTracked(true);
      }
    } catch (error) {
      setSelectedOptionId(null);

      if (question.type === "email" && !activeLead) {
        toast.error(getErrorMessage(error));
        setSubmitting(false);
        return;
      }

      toast.error(
        "A resposta ficou salva neste dispositivo e será sincronizada depois.",
      );
    }

    await moveForward(
      question,
      option,
      activeLead,
      nextAnswers,
      nextVariables,
    );
    setSelectedOptionId(null);
    setSubmitting(false);
  }

  async function moveForward(
    question: PublicQuizQuestion,
    option: PublicQuizOption | undefined,
    activeLead: PublicLeadSession | null,
    currentAnswers: Record<string, string>,
    currentVariables: Record<string, string>,
  ) {
    if (!quiz) {
      return;
    }

    if (option?.nextStep === "final") {
      await finishQuiz(activeLead, currentAnswers, currentVariables);
      return;
    }

    const destination =
      option?.nextStep === "question" && option.nextQuestionId
        ? quiz.questions.find(
            (candidate) => candidate.id === option.nextQuestionId,
          )
        : quiz.questions.find(
            (candidate) => candidate.orderIndex === question.orderIndex + 1,
          );

    if (!destination) {
      await finishQuiz(activeLead, currentAnswers, currentVariables);
      return;
    }

    setHistory((current) => [...current, question.id]);
    setCurrentId(destination.id);
  }

  async function finishQuiz(
    activeLead = lead,
    currentAnswers = answers,
    currentVariables = variables,
  ) {
    setFinished(true);
    let tracked = completeTracked;

    if (activeLead && !completeTracked) {
      try {
        await registerPublicLeadEvent(
          activeLead.id,
          activeLead.writeToken,
          "complete",
          { answeredQuestions: Object.keys(currentAnswers).length },
        );
        tracked = true;
        setCompleteTracked(true);
      } catch {
        toast.error(
          "O quiz foi concluído, mas o tracking será tentado novamente.",
        );
      }
    }

    writeBackup(slug, {
      answers: currentAnswers,
      variables: currentVariables,
      currentId,
      history,
      lead: activeLead,
      started: true,
      startTracked,
      finished: true,
      completeTracked: tracked,
    });
    window.location.assign(`/q/${slug}/result`);
  }

  function goBack() {
    if (finished) {
      setFinished(false);
      return;
    }

    const previousId = history.at(-1);

    if (!previousId) {
      return;
    }

    setHistory((current) => current.slice(0, -1));
    setCurrentId(previousId);
  }

  async function handleCtaClick() {
    if (!quiz?.settings.ctaUrl) {
      return;
    }

    if (lead) {
      try {
        await registerPublicLeadEvent(
          lead.id,
          lead.writeToken,
          "cta_click",
          { url: quiz.settings.ctaUrl },
        );
      } catch {
        // O redirecionamento continua mesmo se o tracking falhar.
      }
    }

    window.location.assign(quiz.settings.ctaUrl);
  }

  function restartQuiz() {
    clearBackup(slug);
    setAnswers({});
    setVariables({});
    setCurrentId(quiz?.questions[0]?.id ?? null);
    setHistory([]);
    setLead(null);
    setStarted(false);
    setStartTracked(false);
    setFinished(false);
    setCompleteTracked(false);
  }

  if (loading) {
    return <PublicLoading />;
  }

  if (notFound || !quiz) {
    return <QuizNotFound />;
  }

  const theme = {
    "--quiz-primary": quiz.settings.primaryColor,
    "--quiz-background": quiz.settings.backgroundColor,
  } as CSSProperties;

  return (
    <main
      className="min-h-screen px-4 py-5 text-navy sm:px-6 sm:py-8"
      style={{ ...theme, backgroundColor: quiz.settings.backgroundColor }}
    >
      <TrackingScripts tracking={quiz.tracking} />

      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] opacity-0"
      />

      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-2xl flex-col sm:min-h-[calc(100vh-64px)]">
        <QuizTopBar
          quiz={quiz}
          progress={finished ? 100 : progress}
          canGoBack={finished || history.length > 0}
          onBack={goBack}
        />

        <section className="flex flex-1 items-center py-7 sm:py-12">
          <div className="w-full">
            {finished || !currentQuestion ? (
              <FinalPage
                quiz={quiz}
                variables={variables}
                onCta={() => void handleCtaClick()}
                onRestart={restartQuiz}
              />
            ) : (
              <QuestionScreen
                key={currentQuestion.id}
                question={currentQuestion}
                value={answers[currentQuestion.id] ?? ""}
                primaryColor={quiz.settings.primaryColor}
                submitting={submitting}
                selectedOptionId={selectedOptionId}
                onAnswer={(value, option) =>
                  void answerQuestion(currentQuestion, value, option)
                }
                onDraftChange={(value) =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: value,
                  }))
                }
              />
            )}
          </div>
        </section>

        <p className="pb-3 text-center text-[11px] font-semibold text-navy/30">
          Criado com Split Master
        </p>
      </div>
    </main>
  );
}

function QuizTopBar({
  quiz,
  progress,
  canGoBack,
  onBack,
}: {
  quiz: PublicQuiz;
  progress: number;
  canGoBack: boolean;
  onBack: () => void;
}) {
  return (
    <header>
      <div className="flex h-14 items-center justify-between gap-4">
        <div className="w-10">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-navy/55 shadow-sm backdrop-blur hover:text-navy"
              aria-label="Voltar para a pergunta anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {quiz.settings.logoUrl ? (
          <div
            className="h-11 w-36 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${quiz.settings.logoUrl}")` }}
            aria-label={quiz.title}
          />
        ) : (
          <div className="rounded-xl bg-white px-3 py-1.5 shadow-sm">
            <Image
              src="/split-master-logo.png"
              alt="Split Master"
              width={601}
              height={328}
              priority
              className="h-auto w-24"
            />
          </div>
        )}

        <span className="w-10 text-right text-xs font-extrabold text-navy/45">
          {progress}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            backgroundColor: quiz.settings.primaryColor,
          }}
        />
      </div>
    </header>
  );
}

function QuestionScreen({
  question,
  value,
  primaryColor,
  submitting,
  selectedOptionId,
  onAnswer,
  onDraftChange,
}: {
  question: PublicQuizQuestion;
  value: string;
  primaryColor: string;
  submitting: boolean;
  selectedOptionId: string | null;
  onAnswer: (value: string, option?: PublicQuizOption) => void;
  onDraftChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const emailError =
    question.type === "email" &&
    touched &&
    value.length > 0 &&
    !isValidEmail(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    onAnswer(value);
  }

  return (
    <div className="quiz-question-enter rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-navy/10 backdrop-blur sm:p-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-navy/35">
        Sua resposta
      </p>
      <h1 className="mt-3 text-2xl font-black leading-tight text-navy sm:text-4xl">
        {question.title}
      </h1>
      {question.description && (
        <p className="mt-3 text-sm leading-6 text-navy/55 sm:text-base">
          {question.description}
        </p>
      )}

      {question.type === "multiple_choice" ? (
        <div className="mt-8 space-y-3">
          {question.options.map((option) => {
            const selected = selectedOptionId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                disabled={submitting}
                onClick={() => onAnswer(option.value, option)}
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border px-5 text-left text-base font-bold text-navy transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait"
                style={{
                  borderColor: selected ? primaryColor : "rgba(15,31,61,.12)",
                  backgroundColor: selected
                    ? `${primaryColor}20`
                    : "rgba(255,255,255,.8)",
                }}
              >
                {option.label}
                {selected ? (
                  <CheckCircle2
                    className="h-5 w-5"
                    style={{ color: primaryColor }}
                  />
                ) : (
                  <ArrowRight className="h-4 w-4 text-navy/25" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8">
          <input
            type={getInputType(question.type)}
            inputMode={getInputMode(question.type)}
            value={
              question.type === "phone" ? formatBrazilianPhone(value) : value
            }
            onChange={(event) =>
              onDraftChange(
                question.type === "phone"
                  ? event.target.value.replace(/\D/g, "").slice(0, 11)
                  : event.target.value,
              )
            }
            onBlur={() => setTouched(true)}
            placeholder={getPlaceholder(question.type)}
            autoComplete={getAutocomplete(question.type)}
            className="min-h-16 w-full rounded-2xl border border-navy/10 bg-white px-5 text-base font-semibold text-navy outline-none transition placeholder:text-navy/25 focus:ring-4"
            style={{
              borderColor: emailError ? "#dc2626" : undefined,
              boxShadow: `0 0 0 0 ${primaryColor}20`,
            }}
          />
          {question.type === "email" && (
            <p
              className={`mt-2 text-xs font-semibold ${
                emailError ? "text-red-600" : "text-navy/40"
              }`}
            >
              {emailError ? "Informe um e-mail válido." : "Não enviamos spam."}
            </p>
          )}
          <button
            type="submit"
            disabled={
              submitting ||
              (question.isRequired && !value.trim()) ||
              Boolean(emailError)
            }
            className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-7 text-sm font-extrabold text-navy shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 12px 30px ${primaryColor}35`,
            }}
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {submitting ? "Salvando..." : "Continuar"}
          </button>
        </form>
      )}
    </div>
  );
}

function FinalPage({
  quiz,
  variables,
  onCta,
  onRestart,
}: {
  quiz: PublicQuiz;
  variables: Record<string, string>;
  onCta: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="quiz-question-enter rounded-3xl border border-white/60 bg-white/90 p-7 text-center shadow-xl shadow-navy/10 backdrop-blur sm:p-12">
      <CheckCircle2
        className="mx-auto h-16 w-16"
        style={{ color: quiz.settings.primaryColor }}
      />
      <h1 className="mt-6 text-3xl font-black leading-tight text-navy sm:text-4xl">
        {interpolateVariables(quiz.settings.finalPageTitle, variables)}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-navy/55 sm:text-base">
        {interpolateVariables(quiz.settings.finalPageMessage, variables)}
      </p>

      {quiz.settings.ctaUrl && (
        <button
          type="button"
          onClick={onCta}
          className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-8 text-base font-extrabold text-navy shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
          style={{
            backgroundColor: quiz.settings.primaryColor,
            boxShadow: `0 14px 35px ${quiz.settings.primaryColor}40`,
          }}
        >
          {quiz.settings.ctaText}
          <ArrowRight className="h-5 w-5" />
        </button>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto mt-5 flex items-center gap-2 text-xs font-bold text-navy/35 hover:text-navy"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Responder novamente
      </button>
    </div>
  );
}

function PublicLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-green" />
        <p className="mt-3 text-sm font-bold text-navy/45">
          Preparando o quiz...
        </p>
      </div>
    </main>
  );
}

function QuizNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-5">
      <div className="max-w-md text-center">
        <div className="mx-auto rounded-2xl bg-white p-4 shadow-sm">
          <Image
            src="/split-master-logo.png"
            alt="Split Master"
            width={601}
            height={328}
            className="mx-auto h-auto w-36"
          />
        </div>
        <h1 className="mt-7 text-3xl font-black text-navy">
          Este quiz não está disponível
        </h1>
        <p className="mt-3 text-sm leading-6 text-navy/50">
          O link pode estar incorreto ou o quiz ainda não foi publicado.
        </p>
      </div>
    </main>
  );
}

function captureAttribution(slug: string): PublicAttribution {
  const storageKey = `split-master:attribution:${slug}`;
  const previous = readJson<PublicAttribution>(storageKey, {});
  const params = new URLSearchParams(window.location.search);
  const current: PublicAttribution = {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    utmContent: params.get("utm_content") || undefined,
    utmTerm: params.get("utm_term") || undefined,
    fbclid: params.get("fbclid") || undefined,
    gclid: params.get("gclid") || undefined,
  };
  const merged = Object.fromEntries(
    Object.entries({ ...previous, ...current }).filter(([, value]) =>
      Boolean(value),
    ),
  ) as PublicAttribution;
  localStorage.setItem(storageKey, JSON.stringify(merged));
  return merged;
}

function readBackup(slug: string): QuizBackup {
  return readJson<QuizBackup>(getBackupKey(slug), emptyBackup);
}

function writeBackup(slug: string, backup: QuizBackup): void {
  localStorage.setItem(getBackupKey(slug), JSON.stringify(backup));
}

function clearBackup(slug: string): void {
  localStorage.removeItem(getBackupKey(slug));
}

function getBackupKey(slug: string): string {
  return `split-master:quiz-progress:${slug}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getVariableName(question: PublicQuizQuestion): string | null {
  if (
    question.type === "name" ||
    question.type === "email" ||
    question.type === "phone"
  ) {
    return question.variableName || question.type;
  }

  return question.variableName;
}

function getContactData(variables: Record<string, string>) {
  return {
    name: variables.name || null,
    phone: variables.phone || null,
  };
}

function interpolateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => variables[name] || "",
  );
}

function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function getInputType(type: PublicQuizQuestion["type"]): string {
  if (type === "email") {
    return "email";
  }
  if (type === "number") {
    return "number";
  }

  return "text";
}

function getInputMode(
  type: PublicQuizQuestion["type"],
): "text" | "email" | "tel" | "numeric" {
  if (type === "email") {
    return "email";
  }
  if (type === "phone") {
    return "tel";
  }
  if (type === "number") {
    return "numeric";
  }

  return "text";
}

function getPlaceholder(type: PublicQuizQuestion["type"]): string {
  const placeholders: Partial<Record<PublicQuizQuestion["type"], string>> = {
    text: "Digite sua resposta",
    name: "Seu nome",
    email: "voce@exemplo.com",
    phone: "(XX) XXXXX-XXXX",
    number: "Digite um número",
  };

  return placeholders[type] ?? "Digite sua resposta";
}

function getAutocomplete(type: PublicQuizQuestion["type"]): string {
  if (type === "name") {
    return "name";
  }
  if (type === "email") {
    return "email";
  }
  if (type === "phone") {
    return "tel";
  }

  return "off";
}

function isAnswered(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isObviouslyFakeEmail(value: string): boolean {
  return [
    "a@a.com",
    "email@email.com",
    "foo@bar.com",
    "test@test.com",
    "teste@teste.com",
  ].includes(value.trim().toLowerCase());
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}
