"use client";

import {
  ArrowLeft,
  LoaderCircle,
  Plus,
  RadioTower,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  type Integration,
  type Quiz,
  getIntegrations,
  getQuizzes,
  saveIntegration,
  testWebhook,
} from "@/lib/api";

interface HeaderDraft {
  id: string;
  key: string;
  value: string;
}

export default function WebhookIntegrationPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"POST" | "GET">("POST");
  const [headers, setHeaders] = useState<HeaderDraft[]>([]);
  const [isActive, setIsActive] = useState(true);
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

    getIntegrations(quizId)
      .then((items) => {
        const webhook =
          items.find((integration) => integration.type === "webhook") ?? null;
        setIntegration(webhook);
        setUrl(getString(webhook?.settings.url));
        setMethod(
          webhook?.settings.method === "GET" || webhook?.settings.method === "POST"
            ? webhook.settings.method
            : "POST",
        );
        setHeaders(
          Object.entries(getRecord(webhook?.settings.headers)).map(
            ([key, value]) => ({ id: createLocalId(), key, value }),
          ),
        );
        setIsActive(webhook?.isActive ?? true);
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)));
  }, [quizId]);

  async function handleTest() {
    setTesting(true);

    try {
      const data = await testWebhook({
        url,
        method,
        headers: getHeaderRecord(headers),
      });
      toast.success(`Webhook entregue com status ${data.status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    try {
      const saved = await saveIntegration({
        quizId,
        type: "webhook",
        isActive,
        settings: {
          url,
          method,
          headers: getHeaderRecord(headers),
        },
      });
      setIntegration(saved);
      toast.success("Webhook salvo.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <LoaderCircle className="h-9 w-9 animate-spin text-green" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Webhook genérico"
        description="Envie cada lead criado ou atualizado para uma automação externa."
      />

      <section className="mx-auto max-w-4xl rounded-3xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
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
            label="Método"
            value={method}
            onChange={(value) => setMethod(value as "POST" | "GET")}
            options={[
              { value: "POST", label: "POST com JSON" },
              { value: "GET", label: "GET com query string" },
            ]}
          />
        </div>

        <TextField
          label="URL do webhook"
          value={url}
          onChange={setUrl}
          placeholder="https://seu-endpoint.com/webhook"
        />

        <label className="mt-4 flex items-center gap-2 text-sm font-extrabold">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-5 w-5 accent-[#00C48C]"
          />
          Integração ativa
        </label>

        <div className="mt-8 border-t border-navy/5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-navy">Headers customizados</h2>
              <p className="mt-1 text-sm text-navy/45">
                Use para enviar tokens ou chaves que seu endpoint espera.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setHeaders((current) => [
                  ...current,
                  { id: createLocalId(), key: "", value: "" },
                ])
              }
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#087A5B]"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          {headers.length > 0 && (
            <div className="mt-4 space-y-3">
              {headers.map((header) => (
                <div
                  key={header.id}
                  className="grid grid-cols-[minmax(110px,0.8fr)_minmax(140px,1fr)_40px] gap-2"
                >
                  <input
                    value={header.key}
                    onChange={(event) =>
                      patchHeader(header.id, { key: event.target.value })
                    }
                    placeholder="Authorization"
                    className={fieldClassName}
                  />
                  <input
                    value={header.value}
                    onChange={(event) =>
                      patchHeader(header.id, { value: event.target.value })
                    }
                    placeholder="Bearer ..."
                    className={fieldClassName}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setHeaders((current) =>
                        current.filter((item) => item.id !== header.id),
                      )
                    }
                    className="inline-flex h-12 items-center justify-center rounded-xl text-navy/30 hover:bg-red-50 hover:text-red-600"
                    aria-label="Excluir header"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-navy/5 pt-5">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !url}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/10 px-5 text-sm font-extrabold disabled:opacity-50"
          >
            {testing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RadioTower className="h-4 w-4" />
            )}
            Testar webhook
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !quizId || !url}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green px-5 text-sm font-extrabold disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {integration ? "Salvar alterações" : "Salvar webhook"}
          </button>
        </div>
      </section>
    </div>
  );

  function patchHeader(id: string, patch: Partial<HeaderDraft>) {
    setHeaders((current) =>
      current.map((header) =>
        header.id === id ? { ...header, ...patch } : header,
      ),
    );
  }
}

function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
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
        <RadioTower className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-2xl font-black text-navy">{title}</h1>
        <p className="mt-1 text-sm text-navy/50">{description}</p>
      </div>
    </div>
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
    <label className="mt-4 block">
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

function getHeaderRecord(headers: HeaderDraft[]): Record<string, string> {
  return Object.fromEntries(
    headers
      .filter((header) => header.key.trim() && header.value.trim())
      .map((header) => [header.key.trim(), header.value.trim()]),
  );
}

function getRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
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
