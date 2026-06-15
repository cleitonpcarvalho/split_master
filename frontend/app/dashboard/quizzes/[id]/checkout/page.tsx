"use client";

import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import {
  type CheckoutConfig,
  type CheckoutProvider,
  checkoutProviderTemplates,
  createCheckoutConfig,
  deleteCheckoutConfig,
  getCheckoutConfigs,
  getQuiz,
  getQuizQuestions,
  updateCheckoutConfig,
} from "@/lib/api";

interface CheckoutDraft {
  localId: string;
  id?: string;
  provider: CheckoutProvider;
  checkoutUrl: string;
  urlTemplate: string;
  customParams: Array<{ id: string; key: string; value: string }>;
  isActive: boolean;
}

const providerLabels: Record<CheckoutProvider, string> = {
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  eduzz: "Eduzz",
  stripe: "Stripe Payment Link",
  custom: "Personalizado",
};

export default function CheckoutSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params.id;
  const [quizTitle, setQuizTitle] = useState("");
  const [drafts, setDrafts] = useState<CheckoutDraft[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckoutDraft | null>(null);

  useEffect(() => {
    Promise.all([
      getQuiz(quizId),
      getCheckoutConfigs(quizId),
      getQuizQuestions(quizId),
    ])
      .then(([quiz, checkouts, questions]) => {
        setQuizTitle(quiz.title);
        setDrafts(checkouts.map(toDraft));
        setVariables(
          Array.from(
            new Set(
              questions
                .flatMap((question) => [
                  question.variableName,
                  question.type === "name" ||
                  question.type === "email" ||
                  question.type === "phone"
                    ? question.type
                    : null,
                ])
                .filter((value): value is string => Boolean(value)),
            ),
          ),
        );
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [quizId]);

  const standardVariables = useMemo(
    () => Array.from(new Set(["name", "email", "phone", ...variables])),
    [variables],
  );

  function addCheckout() {
    const draft = newDraft();
    setDrafts((current) => [...current, draft]);
    window.setTimeout(() => {
      document.getElementById(`checkout-${draft.localId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function patchDraft(localId: string, patch: Partial<CheckoutDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.localId === localId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function changeProvider(localId: string, provider: CheckoutProvider) {
    patchDraft(localId, {
      provider,
      urlTemplate: checkoutProviderTemplates[provider],
    });
  }

  async function saveDraft(draft: CheckoutDraft) {
    if (!draft.checkoutUrl.trim()) {
      toast.error("Informe a URL base do checkout.");
      return;
    }

    setBusyId(draft.localId);
    const customParams = Object.fromEntries(
      draft.customParams
        .filter((param) => param.key.trim())
        .map((param) => [param.key.trim(), param.value]),
    );

    try {
      const saved = draft.id
        ? await updateCheckoutConfig(quizId, draft.id, {
            provider: draft.provider,
            checkoutUrl: draft.checkoutUrl,
            urlTemplate: draft.urlTemplate,
            customParams,
            isActive: draft.isActive,
          })
        : await createCheckoutConfig(quizId, {
            provider: draft.provider,
            checkoutUrl: draft.checkoutUrl,
            urlTemplate: draft.urlTemplate,
            customParams,
            isActive: draft.isActive,
          });
      setDrafts((current) =>
        current.map((item) =>
          item.localId === draft.localId
            ? { ...toDraft(saved), localId: draft.localId }
            : item,
        ),
      );
      toast.success("Checkout salvo.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(draft: CheckoutDraft) {
    const isActive = !draft.isActive;
    patchDraft(draft.localId, { isActive });

    if (!draft.id) {
      return;
    }

    setBusyId(draft.localId);

    try {
      await updateCheckoutConfig(quizId, draft.id, { isActive });
      toast.success(isActive ? "Checkout ativado." : "Checkout desativado.");
    } catch (error) {
      patchDraft(draft.localId, { isActive: draft.isActive });
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    if (!deleteTarget.id) {
      setDrafts((current) =>
        current.filter((draft) => draft.localId !== deleteTarget.localId),
      );
      setDeleteTarget(null);
      return;
    }

    setBusyId(deleteTarget.localId);

    try {
      await deleteCheckoutConfig(quizId, deleteTarget.id);
      setDrafts((current) =>
        current.filter((draft) => draft.localId !== deleteTarget.localId),
      );
      setDeleteTarget(null);
      toast.success("Checkout excluído.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function testCheckout(draft: CheckoutDraft) {
    try {
      const url = buildTestCheckoutUrl(draft, {
        name: "João da Silva",
        email: "joao+teste@exemplo.com",
        phone: "11999999999",
        ...Object.fromEntries(variables.map((variable) => [variable, "valor teste"])),
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
        <LoaderCircle className="h-9 w-9 animate-spin text-green" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] text-navy">
      <header className="sticky top-0 z-20 flex min-h-[73px] items-center gap-3 border-b border-navy/10 bg-white px-4 py-3 shadow-sm sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/quizzes/${quizId}/edit`)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/10 hover:bg-navy/5"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-black sm:text-base">
            Checkouts: {quizTitle}
          </h1>
          <p className="text-[11px] font-semibold text-navy/40">
            Preenchimento seguro com os dados capturados no quiz
          </p>
        </div>
        <Link
          href={`/dashboard/quizzes/${quizId}/final-page`}
          className="hidden min-h-10 items-center rounded-xl border border-navy/10 px-4 text-sm font-extrabold hover:bg-navy/5 sm:inline-flex"
        >
          Editar página final
        </Link>
        <button
          type="button"
          onClick={addCheckout}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green px-4 text-sm font-extrabold"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7 rounded-3xl bg-navy p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green text-navy">
              <CircleDollarSign className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-black">
                Checkout com dados pré-preenchidos
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                O servidor monta a URL somente depois de validar o lead e
                codifica cada valor. Parâmetros sem resposta são removidos.
              </p>
            </div>
          </div>
        </div>

        {drafts.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-navy/15 bg-white p-10 text-center">
            <CircleDollarSign className="mx-auto h-11 w-11 text-navy/20" />
            <h2 className="mt-4 text-lg font-black">
              Nenhum checkout configurado
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-navy/45">
              Cadastre Hotmart, Kiwify, Eduzz, Stripe ou uma integração
              personalizada.
            </p>
            <button
              type="button"
              onClick={addCheckout}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-green px-5 text-sm font-extrabold"
            >
              <Plus className="h-4 w-4" />
              Configurar checkout
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            {drafts.map((draft, index) => (
              <CheckoutCard
                key={draft.localId}
                draft={draft}
                index={index}
                variables={standardVariables}
                busy={busyId === draft.localId}
                onPatch={(patch) => patchDraft(draft.localId, patch)}
                onProviderChange={(provider) =>
                  changeProvider(draft.localId, provider)
                }
                onSave={() => void saveDraft(draft)}
                onToggle={() => void toggleActive(draft)}
                onTest={() => testCheckout(draft)}
                onDelete={() => setDeleteTarget(draft)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir checkout?"
        description="Botões da página final vinculados a este checkout usarão o primeiro checkout ativo disponível."
        confirmLabel="Excluir checkout"
        loading={Boolean(deleteTarget && busyId === deleteTarget.localId)}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function CheckoutCard({
  draft,
  index,
  variables,
  busy,
  onPatch,
  onProviderChange,
  onSave,
  onToggle,
  onTest,
  onDelete,
}: {
  draft: CheckoutDraft;
  index: number;
  variables: string[];
  busy: boolean;
  onPatch: (patch: Partial<CheckoutDraft>) => void;
  onProviderChange: (provider: CheckoutProvider) => void;
  onSave: () => void;
  onToggle: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  function patchParam(
    id: string,
    patch: Partial<CheckoutDraft["customParams"][number]>,
  ) {
    onPatch({
      customParams: draft.customParams.map((param) =>
        param.id === id ? { ...param, ...patch } : param,
      ),
    });
  }

  return (
    <article
      id={`checkout-${draft.localId}`}
      className="rounded-3xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-black">
              Checkout {index + 1} · {providerLabels[draft.provider]}
            </h2>
            {draft.id && (
              <CheckCircle2 className="h-4 w-4 text-[#087A5B]" />
            )}
          </div>
          <p className="mt-1 text-xs text-navy/40">
            {draft.id ? "Configuração salva" : "Nova configuração"}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-extrabold">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={onToggle}
            disabled={busy}
            className="h-5 w-5 accent-[#00C48C]"
          />
          Ativo
        </label>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Plataforma"
          value={draft.provider}
          onChange={(value) => onProviderChange(value as CheckoutProvider)}
          options={Object.entries(providerLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <TextField
          label="URL base do checkout"
          value={draft.checkoutUrl}
          onChange={(checkoutUrl) => onPatch({ checkoutUrl })}
          placeholder="https://pay.exemplo.com/..."
        />
      </div>

      <div className="mt-5">
        <TextAreaField
          label="Template da URL"
          value={draft.urlTemplate}
          onChange={(urlTemplate) => onPatch({ urlTemplate })}
          placeholder="{url}?email={{email}}"
        />
        <p className="mt-2 text-[11px] leading-5 text-navy/40">
          Use <strong>{"{url}"}</strong> para a URL base e variáveis como{" "}
          <strong>{"{{email}}"}</strong>. O modelo do provedor é preenchido
          automaticamente.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {variables.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() =>
                onPatch({
                  urlTemplate: `${draft.urlTemplate}{{${variable}}}`,
                })
              }
              className="rounded-lg bg-green/10 px-2 py-1 text-[11px] font-extrabold text-[#087A5B]"
            >
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 border-t border-navy/5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black">Parâmetros personalizados</h3>
            <p className="mt-1 text-xs text-navy/40">
              Campos adicionais anexados à URL.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onPatch({
                customParams: [
                  ...draft.customParams,
                  { id: createLocalId(), key: "", value: "" },
                ],
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#087A5B]"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>

        {draft.customParams.length > 0 && (
          <div className="mt-4 space-y-3">
            {draft.customParams.map((param) => (
              <div
                key={param.id}
                className="grid grid-cols-[minmax(90px,0.7fr)_minmax(140px,1fr)_40px] gap-2"
              >
                <input
                  value={param.key}
                  onChange={(event) =>
                    patchParam(param.id, { key: event.target.value })
                  }
                  placeholder="chave"
                  className={fieldClassName}
                />
                <input
                  value={param.value}
                  onChange={(event) =>
                    patchParam(param.id, { value: event.target.value })
                  }
                  placeholder="{{variavel}}"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={() =>
                    onPatch({
                      customParams: draft.customParams.filter(
                        (item) => item.id !== param.id,
                      ),
                    })
                  }
                  className="inline-flex h-12 items-center justify-center rounded-xl text-navy/30 hover:bg-red-50 hover:text-red-600"
                  aria-label="Excluir parâmetro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-navy/5 pt-5">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
        <button
          type="button"
          onClick={onTest}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-navy/10 px-4 text-sm font-extrabold hover:bg-navy/5"
        >
          <ExternalLink className="h-4 w-4" />
          Testar link
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green px-5 text-sm font-extrabold disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </button>
      </div>
    </article>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className={fieldClassName}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toDraft(config: CheckoutConfig): CheckoutDraft {
  return {
    localId: config.id,
    id: config.id,
    provider: config.provider,
    checkoutUrl: config.checkoutUrl,
    urlTemplate: config.urlTemplate,
    customParams: Object.entries(config.customParams).map(([key, value]) => ({
      id: createLocalId(),
      key,
      value,
    })),
    isActive: config.isActive,
  };
}

function newDraft(): CheckoutDraft {
  return {
    localId: createLocalId(),
    provider: "hotmart",
    checkoutUrl: "",
    urlTemplate: checkoutProviderTemplates.hotmart,
    customParams: [],
    isActive: true,
  };
}

function buildTestCheckoutUrl(
  draft: CheckoutDraft,
  variables: Record<string, string>,
): string {
  const baseUrl = new URL(draft.checkoutUrl);

  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("Informe uma URL de checkout válida.");
  }

  const template = draft.urlTemplate.trim() || "{url}";
  let query: URLSearchParams;

  if (template.includes("{url}")) {
    const suffix = template.split("{url}", 2)[1] ?? "";
    const queryStart = suffix.indexOf("?");
    query = new URLSearchParams(
      queryStart >= 0 ? suffix.slice(queryStart + 1) : "",
    );
  } else {
    query = new URL(template).searchParams;
  }

  query.forEach((value, key) => {
    const resolved = resolveTemplate(value, variables);

    if (resolved) {
      baseUrl.searchParams.set(key, resolved);
    } else {
      baseUrl.searchParams.delete(key);
    }
  });

  draft.customParams.forEach((param) => {
    if (!param.key.trim()) {
      return;
    }

    const resolved = resolveTemplate(param.value, variables);

    if (resolved) {
      baseUrl.searchParams.set(param.key.trim(), resolved);
    } else {
      baseUrl.searchParams.delete(param.key.trim());
    }
  });

  return baseUrl.toString();
}

function resolveTemplate(
  template: string,
  variables: Record<string, string>,
): string | null {
  let missing = false;
  const value = template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => {
      const replacement = variables[name] || "";

      if (!replacement) {
        missing = true;
      }

      return replacement;
    },
  );

  return missing ? null : value;
}

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

const labelClassName =
  "mb-2 block text-xs font-extrabold text-navy/55";
const fieldClassName =
  "min-h-12 w-full rounded-xl border border-navy/10 bg-white px-3.5 py-3 text-sm font-semibold text-navy outline-none placeholder:text-navy/25 focus:border-green focus:ring-4 focus:ring-green/10";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}
