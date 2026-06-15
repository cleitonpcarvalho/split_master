"use client";

import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eye,
  Filter,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { Modal } from "@/components/dashboard/Modal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  type Lead,
  type LeadDetail,
  type LeadListResponse,
  type Quiz,
  downloadLeadsCsv,
  getLead,
  getLeads,
  getQuizzes,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type PeriodPreset = "7d" | "30d" | "90d" | "custom";
type CompletionFilter = "all" | "completed" | "incomplete";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export default function LeadsPage() {
  const [response, setResponse] = useState<LeadListResponse | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("7d");
  const [customStart, setCustomStart] = useState(toInputDate(daysAgo(6)));
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()));
  const [completion, setCompletion] = useState<CompletionFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );
  const completed =
    completion === "all" ? undefined : completion === "completed";

  useEffect(() => {
    getQuizzes()
      .then(setQuizzes)
      .catch((error: unknown) => toast.error(getErrorMessage(error)));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [quizId, period, customStart, customEnd, completion]);

  useEffect(() => {
    setLoading(true);
    getLeads({
      quizId: quizId || undefined,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      completed,
      page,
      perPage: 20,
    })
      .then(setResponse)
      .catch((error: unknown) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [completed, dateRange.endDate, dateRange.startDate, page, quizId]);

  async function openLead(lead: Lead) {
    setDetailLoading(true);

    try {
      setSelectedLead(await getLead(lead.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function exportCsv() {
    setExporting(true);

    try {
      await downloadLeadsCsv({
        quizId: quizId || undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        completed,
      });
      toast.success("Arquivo CSV gerado com os filtros aplicados.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const leads = response?.data ?? [];
  const pagination = response?.pagination;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Acompanhe cada contato capturado e visualize a jornada completa."
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-green px-5 text-sm font-extrabold text-navy disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
        }
      />

      <LeadFilters
        quizzes={quizzes}
        quizId={quizId}
        period={period}
        customStart={customStart}
        customEnd={customEnd}
        completion={completion}
        onQuizChange={setQuizId}
        onPeriodChange={setPeriod}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onCompletionChange={setCompletion}
      />

      {loading ? (
        <LeadsLoading />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou aguarde os contatos capturados pelos quizzes aparecerem aqui."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm text-navy/55 shadow-sm">
            <span>
              {numberFormatter.format(pagination?.total ?? leads.length)} leads
              encontrados
            </span>
            <span>
              Página {pagination?.page ?? 1} de {pagination?.totalPages ?? 1}
            </span>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-navy/5 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy/[0.025] text-xs uppercase tracking-wide text-navy/45">
                <tr>
                  <th className="px-5 py-3 font-bold">Lead</th>
                  <th className="px-5 py-3 font-bold">Telefone</th>
                  <th className="px-5 py-3 font-bold">Quiz</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Data</th>
                  <th className="px-5 py-3 text-right font-bold">Jornada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy">
                        {lead.name || "Sem nome"}
                      </p>
                      <p className="text-xs text-navy/45">
                        {lead.email || "Sem e-mail"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-navy/60">
                      {lead.phone || "-"}
                    </td>
                    <td className="px-5 py-4 text-navy/60">
                      {lead.quizTitle}
                    </td>
                    <td className="px-5 py-4">
                      <VisualStatus completed={lead.completed} />
                    </td>
                    <td className="px-5 py-4 text-navy/50">
                      {formatDateTime(lead.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openLead(lead)}
                        disabled={detailLoading}
                        className="rounded-lg p-2 text-navy/50 hover:bg-navy/5 hover:text-navy disabled:opacity-50"
                        title="Ver jornada"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {leads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => openLead(lead)}
                className="w-full rounded-2xl border border-navy/5 bg-white p-5 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-navy">
                      {lead.name || "Sem nome"}
                    </p>
                    <p className="mt-1 text-xs text-navy/45">
                      {lead.email || "Sem e-mail"}
                    </p>
                  </div>
                  <VisualStatus completed={lead.completed} />
                </div>
                <p className="mt-4 text-sm font-semibold text-navy/65">
                  {lead.quizTitle}
                </p>
                <p className="mt-1 text-xs text-navy/40">
                  {formatDateTime(lead.createdAt)}
                </p>
              </button>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Modal
        open={Boolean(selectedLead)}
        title={selectedLead?.name || "Jornada do lead"}
        description={`${selectedLead?.quizTitle ?? ""} · ${
          selectedLead ? formatDateTime(selectedLead.createdAt) : ""
        }`}
        size="lg"
        onClose={() => setSelectedLead(null)}
      >
        {selectedLead && <LeadJourney lead={selectedLead} />}
      </Modal>
    </>
  );
}

function LeadFilters({
  quizzes,
  quizId,
  period,
  customStart,
  customEnd,
  completion,
  onQuizChange,
  onPeriodChange,
  onCustomStartChange,
  onCustomEndChange,
  onCompletionChange,
}: {
  quizzes: Quiz[];
  quizId: string;
  period: PeriodPreset;
  customStart: string;
  customEnd: string;
  completion: CompletionFilter;
  onQuizChange: (value: string) => void;
  onPeriodChange: (value: PeriodPreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onCompletionChange: (value: CompletionFilter) => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-navy/5 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-navy">
        <Filter className="h-4 w-4 text-green" />
        Filtros
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <Field label="Quiz">
          <select
            value={quizId}
            onChange={(event) => onQuizChange(event.target.value)}
            className="field-select"
          >
            <option value="">Todos os quizzes</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Período">
          <select
            value={period}
            onChange={(event) =>
              onPeriodChange(event.target.value as PeriodPreset)
            }
            className="field-select"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="custom">Período customizado</option>
          </select>
        </Field>

        <Field label="Status">
          <select
            value={completion}
            onChange={(event) =>
              onCompletionChange(event.target.value as CompletionFilter)
            }
            className="field-select"
          >
            <option value="all">Todos</option>
            <option value="completed">Concluídos</option>
            <option value="incomplete">Não concluídos</option>
          </select>
        </Field>

        {period === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-1">
            <Field label="Início">
              <input
                type="date"
                value={customStart}
                onChange={(event) => onCustomStartChange(event.target.value)}
                className="field-select"
              />
            </Field>
            <Field label="Fim">
              <input
                type="date"
                value={customEnd}
                onChange={(event) => onCustomEndChange(event.target.value)}
                className="field-select"
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadJourney({ lead }: { lead: LeadDetail }) {
  const variables = Object.entries(lead.variables);
  const attribution = [
    ["utm_source", lead.attribution.utmSource],
    ["utm_medium", lead.attribution.utmMedium],
    ["utm_campaign", lead.attribution.utmCampaign],
    ["utm_content", lead.attribution.utmContent],
    ["utm_term", lead.attribution.utmTerm],
    ["fbclid", lead.attribution.fbclid],
    ["gclid", lead.attribution.gclid],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Info label="E-mail" value={lead.email || "Não informado"} />
        <Info label="Telefone" value={lead.phone || "Não informado"} />
        <Info
          label="Status"
          value={lead.completed ? "Concluído" : "Em andamento"}
        />
      </div>

      <section>
        <h3 className="font-extrabold text-navy">Respostas</h3>
        {lead.answerDetails.length === 0 ? (
          <p className="mt-2 text-sm text-navy/50">
            Nenhuma resposta registrada.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {lead.answerDetails.map((answer) => (
              <div key={answer.questionId} className="rounded-xl bg-[#F8F9FA] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-navy/40">
                  {answer.questionTitle}
                </p>
                <p className="mt-1 text-sm font-semibold text-navy">
                  {answer.answerLabel}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {variables.length > 0 && (
        <section>
          <h3 className="font-extrabold text-navy">Variáveis capturadas</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {variables.map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-green/10 px-3 py-1.5 text-xs font-bold text-[#087A5B]"
              >
                {key}: {renderValue(value)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-extrabold text-navy">UTMs e identificadores</h3>
        {attribution.length === 0 ? (
          <p className="mt-2 text-sm text-navy/50">
            Nenhuma UTM registrada para este lead.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {attribution.map(([label, value]) => (
              <Info key={label} label={label ?? ""} value={value ?? ""} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-extrabold text-navy">Timeline de eventos</h3>
        <div className="mt-3 space-y-3">
          {lead.events.map((event) => (
            <div
              key={event.id}
              className="flex gap-3 rounded-xl border border-navy/5 p-4"
            >
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green/10 text-[#087A5B]">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-navy">
                  {event.label}
                  {event.metadata.inferred ? " (estimado)" : ""}
                </p>
                <p className="mt-1 text-xs text-navy/45">
                  {formatDateTime(event.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-navy/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function VisualStatus({ completed }: { completed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-navy/70">
      {completed ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-[#087A5B]" />
          Concluído
        </>
      ) : (
        <>
          <Circle className="h-3.5 w-3.5 text-slate-400" />
          Em andamento
        </>
      )}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex items-center gap-2 rounded-full border border-navy/10 px-4 py-2 text-sm font-bold text-navy disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </button>
      <span className="text-sm font-bold text-navy/55">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex items-center gap-2 rounded-full border border-navy/10 px-4 py-2 text-sm font-bold text-navy disabled:opacity-40"
      >
        Próxima
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-navy/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/40">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

function LeadsLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-20 rounded-2xl bg-white" />
      ))}
    </div>
  );
}

function getDateRange(
  period: PeriodPreset,
  customStart: string,
  customEnd: string,
) {
  if (period === "custom") {
    return {
      startDate: customStart,
      endDate: customEnd,
    };
  }

  const days = period === "7d" ? 6 : period === "30d" ? 29 : 89;

  return {
    startDate: toInputDate(daysAgo(days)),
    endDate: toInputDate(new Date()),
  };
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function renderValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value) ?? String(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}
