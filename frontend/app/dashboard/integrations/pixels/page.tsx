"use client";

import {
  ArrowLeft,
  BarChart3,
  Code2,
  LoaderCircle,
  Megaphone,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  type Integration,
  type IntegrationType,
  type Quiz,
  getIntegrations,
  getQuizzes,
  saveIntegration,
} from "@/lib/api";

export default function PixelsIntegrationPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [gtmId, setGtmId] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [facebookActive, setFacebookActive] = useState(true);
  const [gtmActive, setGtmActive] = useState(true);
  const [ga4Active, setGa4Active] = useState(true);
  const [loading, setLoading] = useState(true);
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
        const facebook = findIntegration(items, "pixel_facebook");
        const gtm = findIntegration(items, "gtm");
        const ga4 = findIntegration(items, "ga4");
        setFacebookPixelId(getString(facebook?.settings.pixelId));
        setGtmId(getString(gtm?.settings.pixelId));
        setGa4Id(getString(ga4?.settings.pixelId));
        setFacebookActive(facebook?.isActive ?? true);
        setGtmActive(gtm?.isActive ?? true);
        setGa4Active(ga4?.isActive ?? true);
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)));
  }, [quizId]);

  async function handleSave() {
    setSaving(true);

    try {
      const tasks = [
        facebookPixelId
          ? saveIntegration({
              quizId,
              type: "pixel_facebook",
              isActive: facebookActive,
              settings: { pixelId: facebookPixelId },
            })
          : null,
        gtmId
          ? saveIntegration({
              quizId,
              type: "gtm",
              isActive: gtmActive,
              settings: { pixelId: gtmId.toUpperCase() },
            })
          : null,
        ga4Id
          ? saveIntegration({
              quizId,
              type: "ga4",
              isActive: ga4Active,
              settings: { pixelId: ga4Id.toUpperCase() },
            })
          : null,
      ].filter(Boolean) as Array<Promise<Integration>>;
      await Promise.all(tasks);
      toast.success("Pixels salvos.");
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
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <Link
          href="/dashboard/integrations"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy/10 bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green text-navy">
          <BarChart3 className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-navy">
            Pixels e rastreamento
          </h1>
          <p className="mt-1 text-sm text-navy/50">
            Injete Facebook Pixel, GTM e GA4 automaticamente no quiz público.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-4xl rounded-3xl border border-navy/5 bg-white p-5 shadow-sm sm:p-7">
        <SelectField
          label="Quiz"
          value={quizId}
          onChange={setQuizId}
          options={quizzes.map((quiz) => ({
            value: quiz.id,
            label: quiz.title,
          }))}
        />

        <div className="mt-6 grid gap-4">
          <PixelField
            icon={Megaphone}
            title="Facebook Pixel"
            description="ID numérico do pixel. Dispara PageView, Lead e Purchase."
            value={facebookPixelId}
            onChange={setFacebookPixelId}
            active={facebookActive}
            onActiveChange={setFacebookActive}
            placeholder="123456789012345"
          />
          <PixelField
            icon={Code2}
            title="Google Tag Manager"
            description="Container GTM. Eventos são enviados ao dataLayer."
            value={gtmId}
            onChange={setGtmId}
            active={gtmActive}
            onActiveChange={setGtmActive}
            placeholder="GTM-XXXXXX"
          />
          <PixelField
            icon={BarChart3}
            title="Google Analytics 4"
            description="Measurement ID GA4. Eventos são enviados via gtag."
            value={ga4Id}
            onChange={setGa4Id}
            active={ga4Active}
            onActiveChange={setGa4Active}
            placeholder="G-XXXXXXXXXX"
          />
        </div>

        <div className="mt-8 flex justify-end border-t border-navy/5 pt-5">
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
            Salvar pixels
          </button>
        </div>
      </section>
    </div>
  );

  function findIntegration(items: Integration[], type: IntegrationType) {
    return items.find((item) => item.type === type) ?? null;
  }
}

function PixelField({
  icon: Icon,
  title,
  description,
  value,
  onChange,
  active,
  onActiveChange,
  placeholder,
}: {
  icon: typeof Megaphone;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  active: boolean;
  onActiveChange: (value: boolean) => void;
  placeholder: string;
}) {
  return (
    <article className="rounded-2xl border border-navy/5 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy/[0.04] text-navy/65">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-[220px] flex-1">
          <h2 className="font-black text-navy">{title}</h2>
          <p className="mt-1 text-sm text-navy/45">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-extrabold">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => onActiveChange(event.target.checked)}
            className="h-5 w-5 accent-[#00C48C]"
          />
          Ativo
        </label>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${fieldClassName} mt-4`}
      />
    </article>
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

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const labelClassName = "mb-2 block text-xs font-extrabold text-navy/55";
const fieldClassName =
  "min-h-12 w-full rounded-xl border border-navy/10 bg-white px-3.5 py-3 text-sm font-semibold text-navy outline-none placeholder:text-navy/25 focus:border-green focus:ring-4 focus:ring-green/10";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}
