"use client";

import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  MousePointerClick,
  PlayCircle,
  ShoppingCart,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  type AnalyticsAnswerDistribution,
  type AnalyticsFunnelStep,
  type AnalyticsQuizSummary,
  type AnalyticsTimelinePoint,
  type AnalyticsUtmDistribution,
  getQuizAnalyticsAnswers,
  getQuizAnalyticsFunnel,
  getQuizAnalyticsSummary,
  getQuizAnalyticsTimeline,
  getQuizAnalyticsUtm,
} from "@/lib/api";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export default function QuizAnalyticsPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const [summary, setSummary] = useState<AnalyticsQuizSummary | null>(null);
  const [timeline, setTimeline] = useState<AnalyticsTimelinePoint[]>([]);
  const [funnel, setFunnel] = useState<AnalyticsFunnelStep[]>([]);
  const [answers, setAnswers] = useState<AnalyticsAnswerDistribution[]>([]);
  const [utm, setUtm] = useState<AnalyticsUtmDistribution[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriodPreset>("7d");
  const [customStart, setCustomStart] = useState(toInputDate(daysAgo(6)));
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()));
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(
    () => getAnalyticsDateRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  useEffect(() => {
    if (!quizId) {
      return;
    }

    setLoading(true);
    Promise.all([
      getQuizAnalyticsSummary(quizId, dateRange),
      getQuizAnalyticsTimeline(quizId, dateRange),
      getQuizAnalyticsFunnel(quizId, dateRange),
      getQuizAnalyticsAnswers(quizId, dateRange),
      getQuizAnalyticsUtm(quizId, dateRange),
    ])
      .then(([summaryData, timelineData, funnelData, answersData, utmData]) => {
        setSummary(summaryData);
        setTimeline(timelineData);
        setFunnel(funnelData);
        setAnswers(answersData);
        setUtm(utmData);
      })
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [dateRange, quizId]);

  const hasData = Boolean(
    summary &&
      (summary.visitors ||
        summary.starts ||
        summary.completions ||
        summary.leads ||
        summary.checkoutClicks),
  );

  return (
    <>
      <PageHeader
        title={summary?.quizName ?? "Analytics do quiz"}
        description="Veja o funil, respostas e origem de tráfego deste quiz."
        action={
          <Link
            href="/dashboard/analytics"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-navy/10 bg-white px-5 text-sm font-extrabold text-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        }
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
          description="Este quiz ainda não recebeu eventos no período selecionado."
        />
      ) : (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <StatCard
              label="Visitantes únicos"
              value={formatNumber(summary.visitors)}
              icon={Users}
            />
            <StatCard
              label="Inícios"
              value={formatNumber(summary.starts)}
              icon={PlayCircle}
            />
            <StatCard
              label="Conclusões"
              value={formatNumber(summary.completions)}
              icon={UserCheck}
            />
            <StatCard
              label="Taxa"
              value={`${formatNumber(summary.completionRate)}%`}
              icon={Target}
            />
            <StatCard
              label="Leads"
              value={formatNumber(summary.leads)}
              icon={CheckCircle2}
            />
            <StatCard
              label="Cliques CTA"
              value={formatNumber(summary.ctaClicks)}
              icon={MousePointerClick}
            />
            <StatCard
              label="Checkout"
              value={formatNumber(summary.checkoutClicks)}
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
            <h2 className="mb-3 text-lg font-extrabold text-navy">
              Funil de conversão
            </h2>
            <FunnelChart steps={funnel} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-extrabold text-navy">
              Distribuição de respostas
            </h2>
            {answers.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Sem perguntas de múltipla escolha"
                description="Quando houver respostas de múltipla escolha, a distribuição aparecerá aqui."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {answers.map((question) => (
                  <AnswerChart key={question.questionId} question={question} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-extrabold text-navy">
              Distribuição de UTMs
            </h2>
            <UtmTable rows={utm} />
          </section>
        </div>
      )}
    </>
  );
}

function FunnelChart({ steps }: { steps: AnalyticsFunnelStep[] }) {
  const max = Math.max(...steps.map((step) => step.count), 1);

  if (steps.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem funil ainda"
        description="O funil será montado conforme visitantes avançarem pelas perguntas."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        {steps.map((step, index) => {
          const previous = steps[index - 1]?.count ?? step.count;
          const rate =
            previous === 0 ? 0 : Math.round((step.count / previous) * 100);

          return (
            <div key={step.key}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-navy">{step.label}</span>
                <span className="font-semibold text-navy/50">
                  {formatNumber(step.count)} · {formatNumber(rate)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-navy/5">
                <div
                  className="h-full rounded-full bg-green"
                  style={{ width: `${Math.max((step.count / max) * 100, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnswerChart({
  question,
}: {
  question: AnalyticsAnswerDistribution;
}) {
  const data = question.options.map((option) => ({
    name: option.label,
    value: option.count,
    percentage: option.percentage,
  }));

  return (
    <div className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-navy">{question.questionTitle}</h3>
          <p className="mt-1 text-sm font-semibold text-navy/45">
            {formatNumber(question.total)} respostas
          </p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,31,61,0.08)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(15,31,61,0.5)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(15,31,61,0.58)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name, props) => [
                `${formatNumber(Number(value))} (${props.payload.percentage}%)`,
                "Respostas",
              ]}
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(15,31,61,0.08)",
                boxShadow: "0 18px 45px rgba(15,31,61,0.12)",
              }}
            />
            <Bar dataKey="value" radius={[0, 10, 10, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={index % 2 === 0 ? "#00C48C" : "#0F1F3D"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UtmTable({ rows }: { rows: AnalyticsUtmDistribution[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem UTMs ainda"
        description="As fontes de tráfego aparecerão quando visitantes chegarem com parâmetros UTM."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-navy/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
            <tr>
              <th className="px-5 py-3 font-bold">Source</th>
              <th className="px-5 py-3 font-bold">Medium</th>
              <th className="px-5 py-3 font-bold">Campaign</th>
              <th className="px-5 py-3 font-bold">Visitantes</th>
              <th className="px-5 py-3 font-bold">Leads</th>
              <th className="px-5 py-3 font-bold">Conversões</th>
              <th className="px-5 py-3 font-bold">Taxa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {rows.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.campaign}`}>
                <td className="px-5 py-4 font-bold text-navy">{row.source}</td>
                <td className="px-5 py-4 text-navy/60">{row.medium}</td>
                <td className="px-5 py-4 text-navy/60">{row.campaign}</td>
                <MetricCell value={row.visitors} />
                <MetricCell value={row.leads} />
                <MetricCell value={row.conversions} />
                <MetricCell value={row.conversionRate} suffix="%" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-[320px] rounded-2xl bg-white" />
      <div className="h-72 rounded-2xl bg-white" />
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
