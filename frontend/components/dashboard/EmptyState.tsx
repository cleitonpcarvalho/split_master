import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-green/10 text-[#008A64]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-extrabold text-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-navy/50">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
