import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-navy/5 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-navy/50">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-navy">
            {value}
          </p>
          {hint && <p className="mt-2 text-xs text-navy/40">{hint}</p>}
        </div>
        <div className="rounded-xl bg-green/10 p-3 text-[#008A64]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
