import { SlidersHorizontal } from "lucide-react";

import { ComingSoonPage } from "@/components/dashboard/ComingSoonPage";

export default function AdminSettingsPage() {
  return (
    <ComingSoonPage
      title="Configurações gerais"
      description="Defina parâmetros globais e preferências administrativas."
      icon={SlidersHorizontal}
    />
  );
}
