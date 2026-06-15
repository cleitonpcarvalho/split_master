"use client";

import {
  ArrowLeft,
  Check,
  Clipboard,
  CircleDollarSign,
  Eye,
  GitFork,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  LayoutTemplate,
  Plus,
  Rocket,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import {
  type OptionNextStep,
  type QuestionOption,
  type QuestionType,
  type Quiz,
  type QuizQuestion,
  createQuestion,
  createQuestionOption,
  deleteQuestion,
  deleteQuestionOption,
  getQuiz,
  getQuizQuestions,
  reorderQuestionOptions,
  reorderQuestions,
  updateQuestion,
  updateQuestionOption,
  updateQuiz,
  uploadQuizLogo,
} from "@/lib/api";

type SaveState = "saved" | "dirty" | "saving";
type MobileTab = "list" | "editor" | "config";

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: "Múltipla escolha",
  text: "Texto livre",
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  number: "Número",
};

const specialVariables: Record<string, QuestionType> = {
  name: "name",
  email: "email",
  phone: "phone",
};

export default function QuizEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params.id;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizQuestion | null>(null);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  useEffect(() => {
    Promise.all([getQuiz(quizId), getQuizQuestions(quizId)])
      .then(([quizData, questionData]) => {
        setQuiz(quizData);
        setQuestions(questionData);
        setSelectedId(questionData[0]?.id ?? null);
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [quizId]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    revisionRef.current += 1;
    setSaveState("dirty");
  }, []);

  const saveChanges = useCallback(
    async (
      options: {
        silent?: boolean;
        force?: boolean;
        quizOverride?: Quiz;
      } = {},
    ): Promise<boolean> => {
      const quizSnapshot = options.quizOverride ?? quiz;

      if (!quizSnapshot || savingRef.current) {
        return !savingRef.current;
      }
      if (!dirtyRef.current && !options.force) {
        return true;
      }

      const revision = revisionRef.current;
      const questionSnapshot = questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
      }));
      savingRef.current = true;
      setSaveState("saving");

      try {
        const updatedQuiz = await updateQuiz(quizSnapshot.id, {
          title: quizSnapshot.title,
          slug: quizSnapshot.slug,
          status: quizSnapshot.status,
          settings: quizSnapshot.settings,
        });

        await Promise.all(
          questionSnapshot.map(async (question) => {
            await updateQuestion(quizSnapshot.id, question.id, {
              title: question.title,
              description: question.description,
              type: question.type,
              variableName: question.variableName,
              isRequired: question.isRequired,
              settings: question.settings,
            });

            await Promise.all(
              question.options.map((option) =>
                updateQuestionOption(question.id, option.id, {
                  label: option.label,
                  value: option.value,
                  variableValue: option.variableValue,
                  nextStep: option.nextStep,
                  nextQuestionId: option.nextQuestionId,
                }),
              ),
            );
          }),
        );

        setQuiz((current) =>
          current
            ? {
                ...current,
                updatedAt: updatedQuiz.updatedAt,
                status: options.quizOverride?.status ?? current.status,
              }
            : current,
        );

        if (revision === revisionRef.current) {
          dirtyRef.current = false;
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }

        if (!options.silent) {
          toast.success("Quiz salvo com sucesso.");
        }

        return true;
      } catch (error) {
        setSaveState("dirty");
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [questions, quiz],
  );

  useEffect(() => {
    saveRef.current = () => saveChanges({ silent: true });
  }, [saveChanges]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current) {
        void saveRef.current();
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function preventUnsavedExit(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, []);

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedId) ?? null,
    [questions, selectedId],
  );

  const variables = useMemo(
    () =>
      Array.from(
        new Set(
          questions
            .map((question) => question.variableName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [questions],
  );

  function patchQuiz(patch: Partial<Quiz>) {
    setQuiz((current) => (current ? { ...current, ...patch } : current));
    markDirty();
  }

  function patchQuizSettings(patch: Record<string, unknown>) {
    setQuiz((current) =>
      current
        ? { ...current, settings: { ...current.settings, ...patch } }
        : current,
    );
    markDirty();
  }

  function patchQuestion(
    questionId: string,
    patch: Partial<QuizQuestion>,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    );
    markDirty();
  }

  function patchOption(
    questionId: string,
    optionId: string,
    patch: Partial<QuestionOption>,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.id === optionId ? { ...option, ...patch } : option,
              ),
            }
          : question,
      ),
    );
    markDirty();
  }

  async function selectQuestion(questionId: string) {
    if (questionId === selectedId) {
      setMobileTab("editor");
      return;
    }

    if (dirtyRef.current && !(await saveChanges({ silent: true }))) {
      return;
    }

    setSelectedId(questionId);
    setMobileTab("editor");
  }

  async function addQuestion() {
    setBusyAction("add-question");

    try {
      if (dirtyRef.current && !(await saveChanges({ silent: true }))) {
        return;
      }

      const created = await createQuestion(quizId);
      const first = await createQuestionOption(created.id);
      const second = await createQuestionOption(created.id);
      const complete = { ...created, options: [first, second] };
      setQuestions((current) => [...current, complete]);
      setSelectedId(created.id);
      setMobileTab("editor");
      toast.success("Pergunta adicionada.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmQuestionDelete() {
    if (!deleteTarget) {
      return;
    }

    setBusyAction(deleteTarget.id);

    try {
      await deleteQuestion(quizId, deleteTarget.id);
      const remaining = questions
        .filter((question) => question.id !== deleteTarget.id)
        .map((question, index) => ({ ...question, orderIndex: index }));
      setQuestions(remaining);
      setSelectedId((current) =>
        current === deleteTarget.id ? (remaining[0]?.id ?? null) : current,
      );
      setDeleteTarget(null);
      toast.success("Pergunta excluída.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function addOption(questionId: string) {
    setBusyAction(`option-${questionId}`);

    try {
      const created = await createQuestionOption(questionId);
      setQuestions((current) =>
        current.map((question) =>
          question.id === questionId
            ? { ...question, options: [...question.options, created] }
            : question,
        ),
      );
      toast.success("Opção adicionada.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeOption(questionId: string, optionId: string) {
    setBusyAction(optionId);

    try {
      await deleteQuestionOption(questionId, optionId);
      setQuestions((current) =>
        current.map((question) =>
          question.id === questionId
            ? {
                ...question,
                options: question.options
                  .filter((option) => option.id !== optionId)
                  .map((option, index) => ({ ...option, orderIndex: index })),
              }
            : question,
        ),
      );
      toast.success("Opção excluída.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) {
      return;
    }

    if (dirtyRef.current && !(await saveChanges({ silent: true }))) {
      return;
    }

    if (result.type === "QUESTION") {
      const reordered = moveItem(
        questions,
        result.source.index,
        result.destination.index,
      ).map((question, index) => ({ ...question, orderIndex: index }));
      setQuestions(reordered);

      try {
        const data = await reorderQuestions(
          quizId,
          reordered.map((question) => question.id),
        );
        setQuestions(data);
        toast.success("Perguntas reordenadas.");
      } catch (error) {
        setQuestions(questions);
        toast.error(getErrorMessage(error));
      }
      return;
    }

    if (result.type.startsWith("OPTIONS:")) {
      const questionId = result.type.replace("OPTIONS:", "");
      const question = questions.find((item) => item.id === questionId);

      if (!question) {
        return;
      }

      const reordered = moveItem(
        question.options,
        result.source.index,
        result.destination.index,
      ).map((option, index) => ({ ...option, orderIndex: index }));
      setQuestions((current) =>
        current.map((item) =>
          item.id === questionId ? { ...item, options: reordered } : item,
        ),
      );

      try {
        const data = await reorderQuestionOptions(
          questionId,
          reordered.map((option) => option.id),
        );
        setQuestions((current) =>
          current.map((item) =>
            item.id === questionId ? { ...item, options: data } : item,
          ),
        );
        toast.success("Opções reordenadas.");
      } catch (error) {
        setQuestions((current) =>
          current.map((item) =>
            item.id === questionId
              ? { ...item, options: question.options }
              : item,
          ),
        );
        toast.error(getErrorMessage(error));
      }
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusyAction("logo");

    try {
      if (dirtyRef.current && !(await saveChanges({ silent: true }))) {
        return;
      }

      const updated = await uploadQuizLogo(quizId, file);
      setQuiz(updated);
      toast.success("Logo atualizada.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      event.target.value = "";
      setBusyAction(null);
    }
  }

  async function publish() {
    if (!quiz) {
      return;
    }

    const activeQuiz = { ...quiz, status: "active" as const };
    setQuiz(activeQuiz);
    markDirty();
    const success = await saveChanges({
      force: true,
      quizOverride: activeQuiz,
      silent: true,
    });

    if (success) {
      toast.success("Quiz publicado.");
    }
  }

  async function openPreview() {
    const preview = window.open("", "_blank");
    const success = await saveChanges({ silent: true });

    if (!success) {
      preview?.close();
      return;
    }

    const url = `/dashboard/quizzes/${quizId}/preview`;

    if (preview) {
      preview.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function goBack() {
    if (
      dirtyRef.current &&
      !window.confirm("Existem alterações não salvas. Deseja sair mesmo assim?")
    ) {
      return;
    }

    router.push("/dashboard/quizzes");
  }

  async function copyVariable(variable: string) {
    await navigator.clipboard.writeText(`{{${variable}}}`);
    toast.success(`{{${variable}}} copiada.`);
  }

  if (loading) {
    return <EditorLoading />;
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <p className="font-bold text-navy">Quiz não encontrado.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-[#F4F6F8] text-navy">
        <EditorHeader
          quiz={quiz}
          saveState={saveState}
          onBack={goBack}
          onTitleChange={(title) => patchQuiz({ title })}
          onSave={() => void saveChanges()}
          onPreview={() => void openPreview()}
          onPublish={() => void publish()}
        />

        <MobileTabs active={mobileTab} onChange={setMobileTab} />

        <main className="grid min-h-[calc(100vh-73px)] lg:grid-cols-[280px_minmax(460px,1fr)_330px]">
          <section
            className={`${mobileTab === "list" ? "block" : "hidden"} border-r border-navy/10 bg-white lg:block`}
          >
            <QuestionList
              questions={questions}
              selectedId={selectedId}
              adding={busyAction === "add-question"}
              onSelect={(id) => void selectQuestion(id)}
              onAdd={() => void addQuestion()}
              onDelete={setDeleteTarget}
            />
          </section>

          <section
            className={`${mobileTab === "editor" ? "block" : "hidden"} min-w-0 p-4 sm:p-6 lg:block lg:p-8`}
          >
            {selectedQuestion ? (
              <QuestionEditor
                question={selectedQuestion}
                questions={questions}
                busyAction={busyAction}
                onPatchQuestion={(patch) =>
                  patchQuestion(selectedQuestion.id, patch)
                }
                onPatchOption={(optionId, patch) =>
                  patchOption(selectedQuestion.id, optionId, patch)
                }
                onAddOption={() => void addOption(selectedQuestion.id)}
                onDeleteOption={(optionId) =>
                  void removeOption(selectedQuestion.id, optionId)
                }
              />
            ) : (
              <EmptyEditor onAdd={() => void addQuestion()} />
            )}
          </section>

          <aside
            className={`${mobileTab === "config" ? "block" : "hidden"} border-l border-navy/10 bg-white p-5 lg:block lg:overflow-y-auto lg:p-6`}
          >
            <QuizConfiguration
              quiz={quiz}
              variables={variables}
              logoLoading={busyAction === "logo"}
              onPatch={patchQuiz}
              onPatchSettings={patchQuizSettings}
              onUploadLogo={uploadLogo}
              onCopyVariable={(variable) => void copyVariable(variable)}
            />
          </aside>
        </main>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Excluir pergunta?"
          description={`A pergunta "${deleteTarget?.title ?? ""}" e suas opções serão excluídas.`}
          confirmLabel="Excluir pergunta"
          loading={Boolean(deleteTarget && busyAction === deleteTarget.id)}
          onConfirm={() => void confirmQuestionDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    </DragDropContext>
  );
}

function EditorHeader({
  quiz,
  saveState,
  onBack,
  onTitleChange,
  onSave,
  onPreview,
  onPublish,
}: {
  quiz: Quiz;
  saveState: SaveState;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[73px] flex-wrap items-center gap-3 border-b border-navy/10 bg-white px-4 py-3 shadow-sm sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/10 text-navy hover:bg-navy/5"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <input
        value={quiz.title}
        onChange={(event) => onTitleChange(event.target.value)}
        aria-label="Nome do quiz"
        className="min-w-0 flex-1 border-0 bg-transparent text-base font-extrabold text-navy outline-none sm:text-lg"
      />

      <SaveIndicator state={saveState} />

      <div className="ml-auto flex items-center gap-2">
        <HeaderButton icon={Eye} label="Visualizar" onClick={onPreview} secondary />
        <HeaderButton
          icon={saveState === "saving" ? LoaderCircle : Save}
          label="Salvar"
          onClick={onSave}
          secondary
          spinning={saveState === "saving"}
        />
        <HeaderButton icon={Rocket} label="Publicar" onClick={onPublish} />
      </div>
    </header>
  );
}

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  secondary = false,
  spinning = false,
}: {
  icon: typeof Save;
  label: string;
  onClick: () => void;
  secondary?: boolean;
  spinning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-extrabold sm:px-4 sm:text-sm ${
        secondary
          ? "border border-navy/10 bg-white text-navy hover:bg-navy/5"
          : "bg-green text-navy shadow-lg shadow-green/20"
      }`}
    >
      <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const config = {
    saved: { label: "Salvo", icon: Check, className: "text-[#087A5B]" },
    dirty: {
      label: "Alterações não salvas",
      icon: Save,
      className: "text-amber-600",
    },
    saving: {
      label: "Salvando...",
      icon: LoaderCircle,
      className: "text-navy/55",
    },
  }[state];
  const Icon = config.icon;

  return (
    <div
      className={`hidden items-center gap-1.5 text-xs font-bold md:flex ${config.className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "saving" ? "animate-spin" : ""}`} />
      {config.label}
    </div>
  );
}

function MobileTabs({
  active,
  onChange,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  const tabs: Array<{ id: MobileTab; label: string }> = [
    { id: "list", label: "Lista" },
    { id: "editor", label: "Editor" },
    { id: "config", label: "Config" },
  ];

  return (
    <div className="sticky top-[73px] z-20 grid grid-cols-3 border-b border-navy/10 bg-white lg:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`min-h-11 border-b-2 text-xs font-extrabold ${
            active === tab.id
              ? "border-green text-navy"
              : "border-transparent text-navy/45"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function QuestionList({
  questions,
  selectedId,
  adding,
  onSelect,
  onAdd,
  onDelete,
}: {
  questions: QuizQuestion[];
  selectedId: string | null;
  adding: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (question: QuizQuestion) => void;
}) {
  return (
    <div className="flex h-full min-h-[calc(100vh-117px)] flex-col lg:min-h-[calc(100vh-73px)]">
      <div className="flex items-center justify-between border-b border-navy/10 px-4 py-4">
        <div>
          <h2 className="font-extrabold text-navy">Perguntas</h2>
          <p className="text-xs text-navy/45">{questions.length} no fluxo</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green text-navy disabled:opacity-50"
          aria-label="Adicionar pergunta"
        >
          {adding ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </button>
      </div>

      <Droppable droppableId="question-list" type="QUESTION">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 space-y-2 overflow-y-auto p-3"
          >
            {questions.map((question, index) => (
              <Draggable
                key={question.id}
                draggableId={question.id}
                index={index}
              >
                {(dragProvided, snapshot) => (
                  <article
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`group flex items-center gap-2 rounded-xl border p-2.5 transition ${
                      selectedId === question.id
                        ? "border-green bg-green/10 shadow-sm"
                        : "border-transparent bg-[#F8F9FA] hover:border-navy/10"
                    } ${snapshot.isDragging ? "shadow-xl" : ""}`}
                  >
                    <button
                      type="button"
                      {...dragProvided.dragHandleProps}
                      aria-label="Reordenar pergunta"
                      className="cursor-grab text-navy/25 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(question.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-navy/35">
                          Pergunta {index + 1}
                        </span>
                        {hasConditionalLogic(question) && (
                          <GitFork className="h-3.5 w-3.5 text-[#008A64]" />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-bold text-navy">
                        {question.title}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(question)}
                      aria-label="Excluir pergunta"
                      className="rounded-lg p-1.5 text-navy/25 opacity-100 hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function QuestionEditor({
  question,
  questions,
  busyAction,
  onPatchQuestion,
  onPatchOption,
  onAddOption,
  onDeleteOption,
}: {
  question: QuizQuestion;
  questions: QuizQuestion[];
  busyAction: string | null;
  onPatchQuestion: (patch: Partial<QuizQuestion>) => void;
  onPatchOption: (optionId: string, patch: Partial<QuestionOption>) => void;
  onAddOption: () => void;
  onDeleteOption: (optionId: string) => void;
}) {
  const specialType = question.variableName
    ? specialVariables[question.variableName.toLowerCase()]
    : undefined;

  function changeVariable(value: string) {
    const normalized = value.trim().toLowerCase();
    const forcedType = specialVariables[normalized];
    onPatchQuestion({
      variableName: value || null,
      ...(forcedType ? { type: forcedType } : {}),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#008A64]">
          Editor da pergunta
        </p>
        <h1 className="mt-1 text-2xl font-black text-navy">
          Configure o conteúdo e o fluxo
        </h1>
      </div>

      <section className="space-y-5 rounded-2xl border border-navy/5 bg-white p-5 shadow-sm sm:p-6">
        <EditorField label="Título da pergunta">
          <textarea
            value={question.title}
            onChange={(event) =>
              onPatchQuestion({ title: event.target.value })
            }
            rows={2}
            maxLength={240}
            className={inputClassName}
          />
        </EditorField>

        <EditorField label="Descrição ou subtítulo" optional>
          <textarea
            value={question.description ?? ""}
            onChange={(event) =>
              onPatchQuestion({ description: event.target.value || null })
            }
            rows={3}
            maxLength={500}
            className={inputClassName}
            placeholder="Ajude o visitante a entender o que deve responder."
          />
        </EditorField>

        <div className="grid gap-5 sm:grid-cols-2">
          <EditorField label="Tipo da pergunta">
            <select
              value={question.type}
              onChange={(event) =>
                onPatchQuestion({
                  type: event.target.value as QuestionType,
                })
              }
              disabled={Boolean(specialType)}
              className={inputClassName}
            >
              {Object.entries(questionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </EditorField>

          <EditorField label="Nome da variável">
            <input
              value={question.variableName ?? ""}
              onChange={(event) => changeVariable(event.target.value)}
              className={inputClassName}
              placeholder="goal, pain_point, budget"
            />
          </EditorField>
        </div>

        {specialType && (
          <div className="rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-[#087A5B]">
            A variável <strong>{question.variableName}</strong> captura um dado
            especial do lead. O tipo foi ajustado automaticamente para{" "}
            <strong>{questionTypeLabels[specialType]}</strong>.
          </div>
        )}

        <label className="flex items-center justify-between gap-4 rounded-xl bg-[#F8F9FA] px-4 py-3">
          <span>
            <span className="block text-sm font-bold text-navy">
              Pergunta obrigatória
            </span>
            <span className="text-xs text-navy/45">
              O visitante precisa responder para continuar.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={question.isRequired}
            onClick={() =>
              onPatchQuestion({ isRequired: !question.isRequired })
            }
            className={`relative h-7 w-12 rounded-full transition ${
              question.isRequired ? "bg-green" : "bg-navy/15"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                question.isRequired ? "left-6" : "left-1"
              }`}
            />
          </button>
        </label>
      </section>

      {question.type === "multiple_choice" && (
        <section className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-navy">
                Opções de resposta
              </h2>
              <p className="text-xs text-navy/45">
                Arraste para ordenar e defina destinos condicionais.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddOption}
              disabled={busyAction === `option-${question.id}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green px-4 text-xs font-extrabold text-navy disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          <Droppable
            droppableId={`options-${question.id}`}
            type={`OPTIONS:${question.id}`}
          >
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-3"
              >
                {question.options.map((option, index) => (
                  <Draggable
                    key={option.id}
                    draggableId={option.id}
                    index={index}
                  >
                    {(dragProvided, snapshot) => (
                      <OptionEditor
                        option={option}
                        question={question}
                        questions={questions}
                        busy={busyAction === option.id}
                        dragging={snapshot.isDragging}
                        dragProvided={dragProvided}
                        onPatch={(patch) => onPatchOption(option.id, patch)}
                        onDelete={() => onDeleteOption(option.id)}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </section>
      )}
    </div>
  );
}

function OptionEditor({
  option,
  question,
  questions,
  busy,
  dragging,
  dragProvided,
  onPatch,
  onDelete,
}: {
  option: QuestionOption;
  question: QuizQuestion;
  questions: QuizQuestion[];
  busy: boolean;
  dragging: boolean;
  dragProvided: Parameters<
    Parameters<typeof Draggable>[0]["children"]
  >[0];
  onPatch: (patch: Partial<QuestionOption>) => void;
  onDelete: () => void;
}) {
  const destination =
    option.nextStep === "question"
      ? (option.nextQuestionId ?? "default")
      : option.nextStep;

  function changeDestination(value: string) {
    if (value === "default" || value === "final") {
      onPatch({
        nextStep: value as OptionNextStep,
        nextQuestionId: null,
      });
      return;
    }

    onPatch({ nextStep: "question", nextQuestionId: value });
  }

  return (
    <article
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      className={`rounded-xl border border-navy/10 bg-[#FBFCFD] p-4 ${
        dragging ? "shadow-xl" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          {...dragProvided.dragHandleProps}
          aria-label="Reordenar opção"
          className="cursor-grab text-navy/25 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-lg p-1.5 text-navy/35 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          aria-label="Excluir opção"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <EditorField label="Label">
          <input
            value={option.label}
            onChange={(event) => onPatch({ label: event.target.value })}
            className={compactInputClassName}
          />
        </EditorField>
        <EditorField label="Valor salvo">
          <input
            value={option.value}
            onChange={(event) => onPatch({ value: event.target.value })}
            className={compactInputClassName}
          />
        </EditorField>
        <EditorField label="Valor da variável" optional>
          <input
            value={option.variableValue ?? ""}
            onChange={(event) =>
              onPatch({ variableValue: event.target.value || null })
            }
            placeholder="investir"
            className={compactInputClassName}
          />
        </EditorField>
        <EditorField label="Ir para pergunta">
          <select
            value={destination}
            onChange={(event) => changeDestination(event.target.value)}
            className={compactInputClassName}
          >
            <option value="default">Próxima pergunta (padrão)</option>
            <option value="final">Página final</option>
            {questions
              .filter((item) => item.id !== question.id)
              .map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. {item.title}
                </option>
              ))}
          </select>
        </EditorField>
      </div>
    </article>
  );
}

function QuizConfiguration({
  quiz,
  variables,
  logoLoading,
  onPatch,
  onPatchSettings,
  onUploadLogo,
  onCopyVariable,
}: {
  quiz: Quiz;
  variables: string[];
  logoLoading: boolean;
  onPatch: (patch: Partial<Quiz>) => void;
  onPatchSettings: (patch: Record<string, unknown>) => void;
  onUploadLogo: (event: ChangeEvent<HTMLInputElement>) => void;
  onCopyVariable: (variable: string) => void;
}) {
  const primaryColor = getSetting(quiz.settings, "primaryColor", "#00C48C");
  const backgroundColor = getSetting(
    quiz.settings,
    "backgroundColor",
    "#FFFFFF",
  );
  const logoUrl = getSetting(quiz.settings, "logoUrl", "");
  const ctaText = getSetting(quiz.settings, "cta_text", "Continuar");
  const ctaUrl = getSetting(quiz.settings, "cta_url", "");
  const finalPageTitle = getSetting(
    quiz.settings,
    "final_page_title",
    "Olá {{name}}, obrigado por responder!",
  );
  const finalPageMessage = getSetting(
    quiz.settings,
    "final_page_message",
    "Recebemos suas respostas e em breve você poderá seguir para o próximo passo.",
  );

  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clipboard className="h-4 w-4 text-[#008A64]" />
          <h2 className="text-sm font-extrabold text-navy">
            Variáveis disponíveis
          </h2>
        </div>
        {variables.length === 0 ? (
          <p className="rounded-xl bg-[#F8F9FA] p-3 text-xs text-navy/45">
            Adicione um nome de variável em alguma pergunta.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => onCopyVariable(variable)}
                className="rounded-lg border border-green/25 bg-green/10 px-2.5 py-1.5 font-mono text-xs font-bold text-[#087A5B] hover:bg-green/20"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-navy/10 pt-6">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#008A64]" />
          <h2 className="text-sm font-extrabold text-navy">
            Configurações do quiz
          </h2>
        </div>

        <EditorField label="Título">
          <input
            value={quiz.title}
            onChange={(event) => onPatch({ title: event.target.value })}
            className={compactInputClassName}
          />
        </EditorField>

        <EditorField label="Slug">
          <div className="flex items-center rounded-xl border border-navy/10 bg-white focus-within:border-green">
            <span className="pl-3 text-sm text-navy/35">/</span>
            <input
              value={quiz.slug}
              onChange={(event) =>
                onPatch({ slug: normalizeSlug(event.target.value) })
              }
              className="min-h-10 min-w-0 flex-1 bg-transparent px-1.5 pr-3 text-sm font-semibold text-navy outline-none"
            />
          </div>
        </EditorField>

        <EditorField label="Status">
          <select
            value={quiz.status}
            onChange={(event) =>
              onPatch({ status: event.target.value as Quiz["status"] })
            }
            className={compactInputClassName}
          >
            <option value="draft">Rascunho</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </EditorField>

        <ColorField
          label="Cor primária"
          value={primaryColor}
          onChange={(value) => onPatchSettings({ primaryColor: value })}
        />
        <ColorField
          label="Cor de fundo"
          value={backgroundColor}
          onChange={(value) => onPatchSettings({ backgroundColor: value })}
        />

        <EditorField label="Logo do quiz" optional>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-navy/20 p-3 hover:border-green">
            <div
              className="h-12 w-16 rounded-lg bg-contain bg-center bg-no-repeat"
              style={{
                backgroundColor: "#F8F9FA",
                backgroundImage: logoUrl ? `url("${logoUrl}")` : undefined,
              }}
            >
              {!logoUrl && (
                <div className="flex h-full items-center justify-center text-navy/25">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-navy">
                {logoLoading ? "Enviando..." : "Selecionar imagem"}
              </span>
              <span className="block text-[11px] text-navy/40">
                PNG, JPG, WEBP ou SVG, até 5 MB
              </span>
            </span>
            {logoLoading && (
              <LoaderCircle className="h-4 w-4 animate-spin text-green" />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onUploadLogo}
              disabled={logoLoading}
              className="sr-only"
            />
          </label>
        </EditorField>
      </section>

      <section className="space-y-4 border-t border-navy/10 pt-6">
        <div>
          <h2 className="text-sm font-extrabold text-navy">Página final</h2>
          <p className="mt-1 text-xs leading-5 text-navy/45">
            Use variáveis como {"{{name}}"} para personalizar a mensagem.
          </p>
        </div>

        <div className="grid gap-2">
          <Link
            href={`/dashboard/quizzes/${quiz.id}/final-page`}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-green px-4 text-sm font-extrabold text-navy"
          >
            <LayoutTemplate className="h-4 w-4" />
            Abrir editor da página final
          </Link>
          <Link
            href={`/dashboard/quizzes/${quiz.id}/checkout`}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-navy/10 px-4 text-sm font-extrabold text-navy hover:bg-navy/5"
          >
            <CircleDollarSign className="h-4 w-4" />
            Configurar checkouts
          </Link>
        </div>

        <EditorField label="Título final">
          <textarea
            value={finalPageTitle}
            onChange={(event) =>
              onPatchSettings({ final_page_title: event.target.value })
            }
            rows={2}
            maxLength={240}
            className={compactInputClassName}
          />
        </EditorField>

        <EditorField label="Mensagem final">
          <textarea
            value={finalPageMessage}
            onChange={(event) =>
              onPatchSettings({ final_page_message: event.target.value })
            }
            rows={4}
            maxLength={1000}
            className={compactInputClassName}
          />
        </EditorField>

        <EditorField label="Texto do CTA">
          <input
            value={ctaText}
            onChange={(event) =>
              onPatchSettings({ cta_text: event.target.value })
            }
            maxLength={100}
            className={compactInputClassName}
          />
        </EditorField>

        <EditorField label="Link do CTA" optional>
          <input
            type="url"
            value={ctaUrl}
            onChange={(event) =>
              onPatchSettings({ cta_url: event.target.value })
            }
            placeholder="https://seu-checkout.com"
            className={compactInputClassName}
          />
        </EditorField>
      </section>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <EditorField label={label}>
      <div className="flex items-center gap-2 rounded-xl border border-navy/10 bg-white p-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 text-sm font-semibold uppercase text-navy outline-none"
        />
      </div>
    </EditorField>
  );
}

function EditorField({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-navy/60">
        {label}
        {optional && <span className="font-medium text-navy/30">(opcional)</span>}
      </span>
      {children}
    </label>
  );
}

function EmptyEditor({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green/10 text-[#008A64]">
          <Plus className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-black text-navy">
          Adicione a primeira pergunta
        </h1>
        <p className="mt-2 text-sm text-navy/50">
          Comece a montar o fluxo que vai qualificar seus leads.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-full bg-green px-5 py-2.5 text-sm font-extrabold text-navy"
        >
          Criar pergunta
        </button>
      </div>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-green" />
        <p className="mt-3 text-sm font-bold text-navy/50">
          Carregando editor...
        </p>
      </div>
    </div>
  );
}

function moveItem<T>(items: T[], source: number, destination: number): T[] {
  const next = [...items];
  const [moved] = next.splice(source, 1);
  next.splice(destination, 0, moved);
  return next;
}

function hasConditionalLogic(question: QuizQuestion): boolean {
  return question.options.some((option) => option.nextStep !== "default");
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/g, "");
}

function getSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof settings[key] === "string" ? settings[key] : fallback;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}

const inputClassName =
  "min-h-11 w-full rounded-xl border border-navy/10 bg-white px-3.5 py-2.5 text-sm font-semibold text-navy outline-none transition placeholder:text-navy/25 focus:border-green focus:ring-2 focus:ring-green/10 disabled:bg-navy/5";
const compactInputClassName =
  "min-h-10 w-full rounded-xl border border-navy/10 bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition placeholder:text-navy/25 focus:border-green focus:ring-2 focus:ring-green/10";
