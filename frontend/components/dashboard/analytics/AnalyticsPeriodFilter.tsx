"use client";

export type AnalyticsPeriodPreset = "7d" | "30d" | "90d" | "custom";

interface AnalyticsPeriodFilterProps {
  period: AnalyticsPeriodPreset;
  customStart: string;
  customEnd: string;
  onPeriodChange: (period: AnalyticsPeriodPreset) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}

export function AnalyticsPeriodFilter({
  period,
  customStart,
  customEnd,
  onPeriodChange,
  onCustomStartChange,
  onCustomEndChange,
}: AnalyticsPeriodFilterProps) {
  return (
    <div className="mb-6 rounded-2xl border border-navy/5 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-navy/45">
            Período
          </span>
          <select
            value={period}
            onChange={(event) =>
              onPeriodChange(event.target.value as AnalyticsPeriodPreset)
            }
            className="field-select"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="custom">Período customizado</option>
          </select>
        </label>

        {period === "custom" && (
          <>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-navy/45">
                Data inicial
              </span>
              <input
                type="date"
                value={customStart}
                onChange={(event) => onCustomStartChange(event.target.value)}
                className="field-select"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-navy/45">
                Data final
              </span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => onCustomEndChange(event.target.value)}
                className="field-select"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

export function getAnalyticsDateRange(
  period: AnalyticsPeriodPreset,
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

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
