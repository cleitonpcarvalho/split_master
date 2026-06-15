"use client";

import {
  BarChart3,
  Blocks,
  Code2,
  Megaphone,
  RadioTower,
  Send,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  type Integration,
  type IntegrationType,
  getIntegrations,
} from "@/lib/api";

const cards: Array<{
  type: IntegrationType;
  title: string;
  description: string;
  href: string;
  icon: typeof Blocks;
  featured?: boolean;
}> = [
  {
    type: "activecampaign",
    title: "ActiveCampaign",
    description: "Sincronize contatos, listas, tags e campos personalizados.",
    href: "/dashboard/integrations/activecampaign",
    icon: Send,
    featured: true,
  },
  {
    type: "webhook",
    title: "Webhook genérico",
    description: "Envie leads para qualquer automação via POST ou GET.",
    href: "/dashboard/integrations/webhook",
    icon: RadioTower,
  },
  {
    type: "pixel_facebook",
    title: "Facebook Pixel",
    description: "Dispare PageView, Lead e Purchase nos quizzes públicos.",
    href: "/dashboard/integrations/pixels",
    icon: Megaphone,
  },
  {
    type: "gtm",
    title: "Google Tag Manager",
    description: "Instale seu container GTM e envie eventos no dataLayer.",
    href: "/dashboard/integrations/pixels",
    icon: Code2,
  },
  {
    type: "ga4",
    title: "Google Analytics 4",
    description: "Conecte seu Measurement ID GA4 aos eventos do quiz.",
    href: "/dashboard/integrations/pixels",
    icon: BarChart3,
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntegrations()
      .then(setIntegrations)
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  const activeTypes = useMemo(
    () =>
      new Set(
        integrations
          .filter((integration) => integration.isActive)
          .map((integration) => integration.type),
      ),
    [integrations],
  );

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte automações, webhooks, pixels e ferramentas de marketing aos seus quizzes."
      />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const connected = activeTypes.has(card.type);

          return (
            <article
              key={card.type}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${
                card.featured
                  ? "border-green/40 shadow-green/10"
                  : "border-navy/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                    card.featured
                      ? "bg-green text-navy"
                      : "bg-navy/[0.04] text-navy/65"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <StatusPill connected={connected} loading={loading} />
              </div>

              <h2 className="mt-5 text-lg font-black text-navy">
                {card.title}
              </h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-navy/50">
                {card.description}
              </p>

              <div className="mt-5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-navy/35">
                  <Tag className="h-3.5 w-3.5" />
                  Por quiz
                </span>
                <Link
                  href={card.href}
                  className="rounded-full bg-navy px-4 py-2 text-sm font-extrabold text-white transition hover:bg-navy/90"
                >
                  Configurar
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function StatusPill({
  connected,
  loading,
}: {
  connected: boolean;
  loading: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-extrabold ${
        connected
          ? "bg-green/15 text-[#087A5B]"
          : "bg-navy/[0.05] text-navy/35"
      }`}
    >
      {loading
        ? "Carregando..."
        : connected
          ? "Conectado"
          : "Não configurado"}
    </span>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar as integrações.";
}
