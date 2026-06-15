import type { QuizStatus } from "@/lib/api";

export function QuizStatusBadge({ status }: { status: QuizStatus }) {
  const styles: Record<QuizStatus, string> = {
    active: "bg-green/10 text-[#087A5B]",
    draft: "bg-amber-50 text-amber-700",
    inactive: "bg-slate-100 text-slate-600",
  };
  const labels: Record<QuizStatus, string> = {
    active: "Ativo",
    draft: "Rascunho",
    inactive: "Inativo",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function BooleanStatusBadge({
  active,
  activeLabel = "Ativo",
  inactiveLabel = "Inativo",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        active
          ? "bg-green/10 text-[#087A5B]"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
