"use client";

import {
  ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type ActiveCampaignField,
  type ActiveCampaignList,
  type ActiveCampaignTag,
  type Integration,
  type QuestionOption,
  type Quiz,
  type QuizQuestion,
  getActiveCampaignFields,
  getActiveCampaignLists,
  getActiveCampaignTags,
  getIntegrations,
  getQuizQuestions,
  getQuizzes,
  saveIntegration,
  testActiveCampaign,
} from "@/lib/api";

interface FieldMappingDraft {
  id: string;
  variable: string;
  fieldId: string;
}

interface AnswerTagDraft {
  id: string;
  questionId: string;
  optionValue: string;
  tag: string;
}

export default function ActiveCampaignPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [listId, setListId] = useState("");
  const [defaultTags, setDefaultTags] = useState("");
  const [fieldMappings, setFieldMappings] = useState<FieldMappingDraft[]>([]);
  const [answerTags, setAnswerTags] = useState<AnswerTagDraft[]>([]);
  const [lists, setLists] = useState<ActiveCampaignList[]>([]);
  const [tags, setTags] = useState<ActiveCampaignTag[]>([]);
  const [fields, setFields] = useState<ActiveCampaignField[]>([]);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuizzes()
      .then((data) => {
        setQuizzes(data);
        setQuizId(data[0]?.id ?? "");
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!quizId) {
      return;
    }

    setLoading(true);
    Promise.all([getQuizQuestions(quizId), getIntegrations(quizId)])
      .then(([questionData, integrations]) => {
        setQuestions(questionData);
        const activeCampaign =
          integrations.find((item) => item.type === "activecampaign") ?? null;
        setIntegration(activeCampaign);
        hydrateFromIntegration(activeCampaign);

        if (activeCampaign) {
          void loadMetadata({ quizId });
        } else {
          setLists([]);
          setTags([]);
          setFields([]);
        }
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [quizId]);

  const variables = useMemo(
    () =>
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
    [questions],
  );
  const choiceOptions = useMemo(
    () =>
      questions
        .filter((question) => question.type === "multiple_choice")
        .flatMap((question) =>
          question.options.map((option) => ({ question, option })),
        ),
    [questions],
  );

  function hydrateFromIntegration(activeCampaign: Integration | null) {
    if (!activeCampaign) {
      setApiUrl("");
      setApiKey("");
      setListId("");
      setDefaultTags("");
      setFieldMappings([]);
      setAnswerTags([]);
      setConnectionVerified(false);
      return;
    }

    const settings = activeCampaign.settings;
    setApiUrl(getString(settings.apiUrl));
    setApiKey("");
    setListId(getString(settings.listId));
    setDefaultTags(getStringArray(settings.defaultTags).join(", "));
    setFieldMappings(
      getArray(settings.fieldMappings).map((mapping) => ({
        id: createLocalId(),
        variable: getString(mapping.variable),
        fieldId: getString(mapping.fieldId),
      })),
    );
    setAnswerTags(
      getArray(settings.answerTags).map((mapping) => ({
        id: createLocalId(),
        questionId: getString(mapping.questionId),
        optionValue: getString(mapping.optionValue),
        tag: getString(mapping.tag),
      })),
    );
    setConnectionVerified(Boolean(settings.hasApiKey));
  }

  async function loadMetadata(input: {
    quizId?: string;
    apiUrl?: string;
    apiKey?: string;
  }) {
    try {
      const [listData, tagData, fieldData] = await Promise.all([
        getActiveCampaignLists(input),
        getActiveCampaignTags(input),
        getActiveCampaignFields(input),
      ]);
      setLists(listData);
      setTags(tagData);
      setFields(fieldData);
    } catch {
      // Os metadados podem ser carregados depois pelo botão de teste.
    }
  }

  async function handleTest() {
    setTesting(true);

    try {
      const data = await testActiveCampaign(
        apiKey
          ? { apiUrl, apiKey }
          : { quizId, apiUrl: apiUrl || undefined },
      );
      setLists(data.lists);
      setTags(data.tags);
      setFields(data.fields);
      setConnectionVerified(true);
      toast.success("Conexão com ActiveCampaign validada.");
    } catch (error) {
      setConnectionVerified(false);
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!connectionVerified) {
      toast.error("Teste a conexão antes de salvar.");
      return;
    }

    setSaving(true);

    try {
      const saved = await saveIntegration({
        quizId,
        type: "activecampaign",
        isActive: true,
        settings: {
          apiUrl,
          ...(apiKey ? { apiKey } : {}),
          listId: listId || null,
          defaultTags: defaultTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          fieldMappings: fieldMappings.filter(
            (mapping) => mapping.variable && mapping.fieldId,
          ),
          answerTags: answerTags.filter(
            (mapping) => mapping.questionId && mapping.optionValue && mapping.tag,
          ),
        },
      });
      setIntegration(saved);
      setApiKey("");
      toast.success("ActiveCampaign salvo.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading && quizzes.length === 0) {
    return <LoadingState />;
  }

  return (
    <div>
      <Header
        title="ActiveCampaign"
        description="Crie ou atualize contatos automaticamente quando um lead responde ao quiz."
        icon={Send}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <Card title="Credenciais e lista padrão">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Quiz"
                value={quizId}
                onChange={setQuizId}
                options={quizzes.map((quiz) => ({
                  value: quiz.id,
                  label: quiz.title,
                }))}
              />
              <SelectField
                label="Lista padrão"
                value={listId}
                onChange={setListId}
                options={[
                  { value: "", label: "Não adicionar à lista" },
                  ...lists.map((list) => ({
                    value: list.id,
                    label: list.name,
                  })),
                ]}
              />
            </div>
            <TextField
              label="API URL"
              value={apiUrl}
              onChange={(value) => {
                setApiUrl(value);
                setConnectionVerified(false);
              }}
              placeholder="https://suaconta.api-us1.com"
            />
            <TextField
              label={integration ? "API Key nova (opcional)" : "API Key"}
              type="password"
              value={apiKey}
              onChange={(value) => {
                setApiKey(value);
                setConnectionVerified(false);
              }}
              placeholder={
                integration ? "Deixe em branco para manter a chave salva" : ""
              }
            />
            <TextField
              label="Tags padrão, separadas por vírgula"
              value={defaultTags}
              onChange={setDefaultTags}
              placeholder="lead-quiz, interessado"
              list="activecampaign-tags"
            />
            <datalist id="activecampaign-tags">
              {tags.map((tag) => (
                <option key={tag.id} value={tag.name} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing || !apiUrl || (!apiKey && !integration)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/10 px-5 text-sm font-extrabold disabled:opacity-50"
              >
                {testing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {testing ? "Testando..." : "Testar conexão"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !quizId}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green px-5 text-sm font-extrabold disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar integração
              </button>
            </div>
          </Card>

          <Card title="Mapeamento de variáveis para campos personalizados">
            <div className="space-y-3">
              {fieldMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="grid gap-2 sm:grid-cols-[1fr_1.3fr_44px]"
                >
                  <SelectField
                    label="Variável do quiz"
                    value={mapping.variable}
                    onChange={(variable) =>
                      patchMapping(mapping.id, { variable })
                    }
                    options={[
                      { value: "", label: "Selecione" },
                      ...variables.map((variable) => ({
                        value: variable,
                        label: variable,
                      })),
                    ]}
                  />
                  <SelectField
                    label="Campo no ActiveCampaign"
                    value={mapping.fieldId}
                    onChange={(fieldId) =>
                      patchMapping(mapping.id, { fieldId })
                    }
                    options={[
                      { value: "", label: "Selecione" },
                      ...fields.map((field) => ({
                        value: field.id,
                        label: `${field.title} (${field.perstag || field.id})`,
                      })),
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFieldMappings((current) =>
                        current.filter((item) => item.id !== mapping.id),
                      )
                    }
                    className="mt-6 inline-flex h-12 items-center justify-center rounded-xl text-navy/30 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover mapeamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setFieldMappings((current) => [
                  ...current,
                  { id: createLocalId(), variable: "", fieldId: "" },
                ])
              }
              className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#087A5B]"
            >
              <Plus className="h-4 w-4" />
              Adicionar mapeamento
            </button>
          </Card>

          <Card title="Tags por resposta">
            {choiceOptions.length === 0 ? (
              <p className="text-sm text-navy/45">
                Este quiz ainda não possui perguntas de múltipla escolha.
              </p>
            ) : (
              <div className="space-y-3">
                {choiceOptions.map(({ question, option }) => {
                  const current =
                    answerTags.find(
                      (item) =>
                        item.questionId === question.id &&
                        item.optionValue === option.value,
                    ) ?? null;

                  return (
                    <div
                      key={`${question.id}-${option.id}`}
                      className="grid gap-3 rounded-2xl border border-navy/5 p-4 sm:grid-cols-[1fr_220px]"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-navy">
                          {question.title}
                        </p>
                        <p className="mt-1 text-xs text-navy/45">
                          Se resposta = {option.label}
                        </p>
                      </div>
                      <TextField
                        label="Tag no AC"
                        value={current?.tag ?? ""}
                        onChange={(tag) =>
                          patchAnswerTag(question.id, option, tag)
                        }
                        list="activecampaign-tags"
                        placeholder="tag-da-resposta"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <aside className="rounded-3xl border border-navy/5 bg-white p-6 shadow-sm">
          <h2 className="font-black text-navy">Status</h2>
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${
              connectionVerified
                ? "bg-green/15 text-[#087A5B]"
                : "bg-navy/[0.04] text-navy/45"
            }`}
          >
            {connectionVerified ? "Conectado" : "Não testado"}
          </p>
          <div className="mt-6 space-y-3 text-sm text-navy/50">
            <p>Listas carregadas: {lists.length}</p>
            <p>Tags carregadas: {tags.length}</p>
            <p>Campos carregados: {fields.length}</p>
            <p>Variáveis disponíveis: {variables.length}</p>
          </div>
        </aside>
      </div>
    </div>
  );

  function patchMapping(id: string, patch: Partial<FieldMappingDraft>) {
    setFieldMappings((current) =>
      current.map((mapping) =>
        mapping.id === id ? { ...mapping, ...patch } : mapping,
      ),
    );
  }

  function patchAnswerTag(
    questionId: string,
    option: QuestionOption,
    tag: string,
  ) {
    setAnswerTags((current) => {
      const exists = current.some(
        (item) =>
          item.questionId === questionId && item.optionValue === option.value,
      );

      if (!tag.trim()) {
        return current.filter(
          (item) =>
            !(
              item.questionId === questionId &&
              item.optionValue === option.value
            ),
        );
      }

      if (!exists) {
        return [
          ...current,
          {
            id: createLocalId(),
            questionId,
            optionValue: option.value,
            tag,
          },
        ];
      }

      return current.map((item) =>
        item.questionId === questionId && item.optionValue === option.value
          ? { ...item, tag }
          : item,
      );
    });
  }
}

function Header({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Send;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center gap-4">
      <Link
        href="/dashboard/integrations"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/10 bg-white"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green text-navy">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-2xl font-black text-navy">{title}</h1>
        <p className="mt-1 text-sm text-navy/50">{description}</p>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="mb-5 text-lg font-black text-navy">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  list?: string;
}) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={list}
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

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <LoaderCircle className="h-9 w-9 animate-spin text-green" />
    </div>
  );
}

function getArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function createLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

const labelClassName = "mb-2 block text-xs font-extrabold text-navy/55";
const fieldClassName =
  "min-h-12 w-full rounded-xl border border-navy/10 bg-white px-3.5 py-3 text-sm font-semibold text-navy outline-none placeholder:text-navy/25 focus:border-green focus:ring-4 focus:ring-green/10";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}
