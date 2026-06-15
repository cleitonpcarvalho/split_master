"use client";

import {
  ArrowUpRight,
  BarChart3,
  MousePointerClick,
  PlayCircle,
  ShoppingCart,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AnalyticsLineChart } from "@/components/dashboard/analytics/AnalyticsLineChart";
import {
  AnalyticsPeriodFilter,
  type AnalyticsPeriodPreset,
  daysAgo,
  getAnalyticsDateRange,
  toInputDate,
} from "@/components/dashboard/analytics/AnalyticsPeriodFilter";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  type AnalyticsSummary,
  type AnalyticsTimelinePoint,
  getAnalyticsSummary,
  getAnalyticsTimeline,
} from "@/lib/api";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeline, setTimeline] = useState<AnalyticsTimelinePoint[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriodPreset>("7d");
  const [customStart, setCustomStart] = useState(toInputDate(daysAgo(6)));
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()));
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(
    () => getAnalyticsDateRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAnalyticsSummary(dateRange),
      getAnalyticsTimeline(dateRange),
    ])
      .then(([summaryData, timelineData]) => {
        setSummary(summaryData);
        setTimeline(timelineData);
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [dateRange]);

  const totals = summary?.totals;
  const hasData = Boolean(
    totals &&
      (totals.visitors ||
        totals.starts ||
        totals.completions ||
        totals.leads ||
        totals.checkoutClicks),
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Acompanhe visitas, inícios, conclusões, leads e cliques no checkout."
      />

      <AnalyticsPeriodFilter
        period={period}
        customStart={customStart}
        customEnd={customEnd}
        onPeriodChange={setPeriod}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      {loading ? (
        <AnalyticsLoading />
      ) : !summary || !hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Sem dados ainda"
          description="Assim que seus quizzes receberem visitantes, os indicadores aparecerão nesta tela."
        />
      ) : (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="Total de visitantes"
              value={formatNumber(totals?.visitors ?? 0)}
              icon={Users}
            />
            <StatCard
              label="Total de inícios"
              value={formatNumber(totals?.starts ?? 0)}
              icon={PlayCircle}
            />
            <StatCard
              label="Total de conclusões"
              value={formatNumber(totals?.completions ?? 0)}
              icon={UserCheck}
            />
            <StatCard
              label="Taxa média"
              value={`${formatNumber(totals?.completionRate ?? 0)}%`}
              icon={Target}
            />
            <StatCard
              label="Leads captados"
              value={formatNumber(totals?.leads ?? 0)}
              icon={MousePointerClick}
            />
            <StatCard
              label="Cliques checkout"
              value={formatNumber(totals?.checkoutClicks ?? 0)}
              icon={ShoppingCart}
            />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-extrabold text-navy">
              Evolução diária
            </h2>
            <AnalyticsLineChart data={timeline} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-navy">
                Resumo por quiz
              </h2>
              <span className="text-sm font-semibold text-navy/45">
                {formatNumber(summary.quizzes.length)} quizzes
              </span>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-navy/5 bg-white shadow-sm lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
                  <tr>
                    <th className="px-5 py-3 font-bold">Quiz</th>
                    <th className="px-5 py-3 font-bold">Visitantes</th>
                    <th className="px-5 py-3 font-bold">Inícios</th>
                    <th className="px-5 py-3 font-bold">Conclusões</th>
                    <th className="px-5 py-3 font-bold">Taxa</th>
                    <th className="px-5 py-3 font-bold">Leads</th>
                    <th className="px-5 py-3 font-bold">Checkout</th>
                    <th className="px-5 py-3 text-right font-bold">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {summary.quizzes.map((quiz) => (
                    <tr key={quiz.quizId}>
                      <td className="px-5 py-4 font-bold text-navy">
                        {quiz.quizName}
                      </td>
                      <MetricCell value={quiz.visitors} />
                      <MetricCell value={quiz.starts} />
                      <MetricCell value={quiz.completions} />
                      <MetricCell value={quiz.completionRate} suffix="%" />
                      <MetricCell value={quiz.leads} />
                      <MetricCell value={quiz.checkoutClicks} />
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/analytics/${quiz.quizId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-green/10 px-3 py-1.5 text-xs font-extrabold text-[#087A5B]"
                        >
                          Ver detalhe
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 lg:hidden">
              {summary.quizzes.map((quiz) => (
                <Link
                  key={quiz.quizId}
                  href={`/dashboard/analytics/${quiz.quizId}`}
                  className="block rounded-2xl border border-navy/5 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-extrabold text-navy">{quiz.quizName}</p>
                      <p className="mt-1 text-xs font-semibold text-navy/45">
                        Taxa de conclusão: {formatNumber(quiz.completionRate)}%
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-green" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MiniMetric label="Visitantes" value={quiz.visitors} />
                    <MiniMetric label="Inícios" value={quiz.starts} />
                    <MiniMetric label="Conclusões" value={quiz.completions} />
                    <MiniMetric label="Checkout" value={quiz.checkoutClicks} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function MetricCell({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  return (
    <td className="px-5 py-4 font-semibold text-navy/60">
      {formatNumber(value)}
      {suffix}
    </td>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F8F9FA] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/40">
        {label}
      </p>
      <p className="mt-1 font-extrabold text-navy">{formatNumber(value)}</p>
    </div>
  );
}

function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-[320px] rounded-2xl bg-white" />
      <div className="h-72 rounded-2xl bg-white" />
    </div>
  );
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar os analytics.";
}
