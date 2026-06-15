"use client";

import {
  Copy,
  FileQuestion,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizStatusBadge } from "@/components/dashboard/StatusBadge";
import {
  type Quiz,
  type QuizStatus,
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  getQuizzes,
  getUserQuizzes,
  updateQuiz,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function QuizzesPage() {
  return (
    <Suspense fallback={<QuizzesLoading />}>
      <QuizzesContent />
    </Suspense>
  );
}

function QuizzesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? undefined;
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [status, setStatus] = useState<QuizStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);

    try {
      const data = userId
        ? await getUserQuizzes(userId)
        : await getQuizzes({
            status: status === "all" ? undefined : status,
          });
      setQuizzes(
        userId && status !== "all"
          ? data.filter((quiz) => quiz.status === status)
          : data,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, userId]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  async function openCreate() {
    setCreating(true);

    try {
      const quiz = await createQuiz({ title: "Novo quiz" });
      router.push(`/dashboard/quizzes/${quiz.id}/edit`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(quiz: Quiz) {
    router.push(`/dashboard/quizzes/${quiz.id}/edit`);
  }

  async function handleDuplicate(quiz: Quiz) {
    setBusyId(quiz.id);

    try {
      await duplicateQuiz(quiz.id);
      toast.success("Quiz duplicado com sucesso.");
      await loadQuizzes();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleQuiz(quiz: Quiz) {
    setBusyId(quiz.id);
    const nextStatus: QuizStatus =
      quiz.status === "active" ? "inactive" : "active";

    try {
      await updateQuiz(quiz.id, { status: nextStatus });
      toast.success(
        nextStatus === "active" ? "Quiz ativado." : "Quiz desativado.",
      );
      await loadQuizzes();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await deleteQuiz(deleteTarget.id);
      toast.success("Quiz excluído.");
      setDeleteTarget(null);
      await loadQuizzes();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={userId ? "Quizzes do usuário" : "Quizzes"}
        description={
          userId
            ? "Visualize os quizzes vinculados a este cliente."
            : "Crie, publique e gerencie seus quizzes de vendas."
        }
        action={
          !userId && (
            <button
              type="button"
              onClick={() => void openCreate()}
              disabled={creating}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-green px-5 text-sm font-extrabold text-navy shadow-lg shadow-green/20"
            >
              {creating ? (
                <MoreHorizontal className="h-4 w-4 animate-pulse" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Criando..." : "Criar novo quiz"}
            </button>
          )
        }
      />

      <div className="mb-5 flex items-center gap-3">
        <label htmlFor="quiz-status" className="text-sm font-bold text-navy/60">
          Status
        </label>
        <select
          id="quiz-status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as QuizStatus | "all")
          }
          className="min-h-10 rounded-xl border border-navy/10 bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-green"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="draft">Rascunhos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {loading ? (
        <QuizzesLoading />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Nenhum quiz encontrado"
          description="Ajuste o filtro ou crie um novo quiz para começar."
          action={
            !userId && (
              <button
                type="button"
                onClick={() => void openCreate()}
                disabled={creating}
                className="rounded-full bg-green px-5 py-2.5 text-sm font-extrabold text-navy"
              >
                {creating ? "Criando..." : "Criar quiz"}
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-navy/5 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
                <tr>
                  <th className="px-5 py-3 font-bold">Quiz</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Leads</th>
                  <th className="px-5 py-3 font-bold">Criado em</th>
                  <th className="px-5 py-3 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {quizzes.map((quiz) => (
                  <QuizRow
                    key={quiz.id}
                    quiz={quiz}
                    busy={busyId === quiz.id}
                    onEdit={() => openEdit(quiz)}
                    onDuplicate={() => handleDuplicate(quiz)}
                    onToggle={() => toggleQuiz(quiz)}
                    onDelete={() => setDeleteTarget(quiz)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {quizzes.map((quiz) => (
              <QuizMobileCard
                key={quiz.id}
                quiz={quiz}
                busy={busyId === quiz.id}
                onEdit={() => openEdit(quiz)}
                onDuplicate={() => handleDuplicate(quiz)}
                onToggle={() => toggleQuiz(quiz)}
                onDelete={() => setDeleteTarget(quiz)}
              />
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir quiz?"
        description={`O quiz "${deleteTarget?.title ?? ""}" e todos os seus dados serão excluídos permanentemente.`}
        confirmLabel="Excluir quiz"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface QuizActionsProps {
  quiz: Quiz;
  busy: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function QuizRow(props: QuizActionsProps) {
  const { quiz } = props;

  return (
    <tr>
      <td className="px-5 py-4">
        <p className="font-bold text-navy">{quiz.title}</p>
        <p className="mt-1 text-xs text-navy/45">/{quiz.slug}</p>
      </td>
      <td className="px-5 py-4">
        <QuizStatusBadge status={quiz.status} />
      </td>
      <td className="px-5 py-4 font-semibold text-navy/65">{quiz.leadsCount}</td>
      <td className="px-5 py-4 text-navy/55">{formatDate(quiz.createdAt)}</td>
      <td className="px-5 py-4">
        <QuizActions {...props} />
      </td>
    </tr>
  );
}

function QuizMobileCard(props: QuizActionsProps) {
  const { quiz } = props;

  return (
    <article className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-navy">{quiz.title}</h2>
          <p className="mt-1 text-xs text-navy/45">/{quiz.slug}</p>
        </div>
        <QuizStatusBadge status={quiz.status} />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-navy/50">
        <span>{quiz.leadsCount} leads</span>
        <span>{formatDate(quiz.createdAt)}</span>
      </div>
      <div className="mt-4 border-t border-navy/5 pt-3">
        <QuizActions {...props} mobile />
      </div>
    </article>
  );
}

function QuizActions({
  quiz,
  busy,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  mobile = false,
}: QuizActionsProps & { mobile?: boolean }) {
  const actions = [
    { label: "Editar", icon: Pencil, action: onEdit },
    { label: "Duplicar", icon: Copy, action: onDuplicate },
    {
      label: quiz.status === "active" ? "Desativar" : "Ativar",
      icon: Power,
      action: onToggle,
    },
    { label: "Excluir", icon: Trash2, action: onDelete, danger: true },
  ];

  return (
    <div
      className={`flex items-center ${mobile ? "justify-between" : "justify-end gap-1"}`}
    >
      {actions.map(({ label, icon: Icon, action, danger }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          disabled={busy}
          title={label}
          className={`inline-flex items-center gap-1.5 rounded-lg p-2 text-xs font-bold transition disabled:opacity-40 ${
            danger
              ? "text-red-600 hover:bg-red-50"
              : "text-navy/55 hover:bg-navy/5 hover:text-navy"
          }`}
        >
          <Icon className="h-4 w-4" />
          {mobile && label}
        </button>
      ))}
      {!mobile && busy && <MoreHorizontal className="h-4 w-4 animate-pulse" />}
    </div>
  );
}

function QuizzesLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
