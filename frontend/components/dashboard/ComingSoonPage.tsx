import type { LucideIcon } from "lucide-react";

import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

export function ComingSoonPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="Módulo preparado"
        description="A navegação e o controle de acesso já estão prontos. As funcionalidades deste módulo entram na próxima etapa do produto."
      />
    </>
  );
}
