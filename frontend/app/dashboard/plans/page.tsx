import { CreditCard } from "lucide-react";

import { ComingSoonPage } from "@/components/dashboard/ComingSoonPage";

export default function PlansPage() {
  return (
    <ComingSoonPage
      title="Planos e Assinaturas"
      description="Gerencie planos, limites e assinaturas dos clientes."
      icon={CreditCard}
    />
  );
}
