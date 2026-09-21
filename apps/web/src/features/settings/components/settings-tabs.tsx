"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResetDataActions } from "@/features/system";
import { OrganizationSettingsForm } from "./organization-settings-card";
import { BusinessHoursForm } from "./business-hours-card";

type Tab = "geral" | "horarios" | "dados";

const TABS: {
  value: Tab;
  label: string;
  icon: typeof Building2;
  description: string;
}[] = [
  {
    value: "geral",
    label: "Geral",
    icon: Building2,
    description:
      "Identificação do negócio, canais de contato, endereço da unidade e regras padrão de cobrança.",
  },
  {
    value: "horarios",
    label: "Horários",
    icon: Clock,
    description:
      "Define o expediente e os turnos de funcionamento da unidade — usado para validar os agendamentos.",
  },
  {
    value: "dados",
    label: "Dados de exemplo",
    icon: Database,
    description:
      "Suas alterações ficam salvas no navegador (localStorage). Ao zerar os mocks, todo o armazenamento local é redefinido, mantendo apenas os proprietários iniciais para você cadastrar tudo do zero.",
  },
];

/**
 * Configurações em abas: uma seção por vez (Geral / Horários / Dados). Os três
 * painéis ficam montados e alternamos só a visibilidade, para não descartar
 * edições em andamento ao trocar de aba.
 */
function isTab(value: string | null): value is Tab {
  return value === "geral" || value === "horarios" || value === "dados";
}

export function SettingsTabs() {
  const searchParams = useSearchParams();
  // Deep-link: `/settings?tab=horarios` (ex.: passo do onboarding) abre a aba.
  const initialTab: Tab = isTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as Tab)
    : "geral";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="max-w-3xl">
      <div
        role="tablist"
        aria-label="Seções de configurações"
        className="mb-6 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {TABS.map((t) => {
          const active = t.value === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`settings-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`settings-panel-${t.value}`}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`settings-panel-${t.value}`}
          aria-labelledby={`settings-tab-${t.value}`}
          hidden={t.value !== tab}
          className="space-y-4"
        >
          {t.value !== "geral" ? (
            <p className="text-sm text-muted-foreground">{t.description}</p>
          ) : null}
          {t.value === "geral" ? <OrganizationSettingsForm /> : null}
          {t.value === "horarios" ? <BusinessHoursForm /> : null}
          {t.value === "dados" ? <ResetDataActions /> : null}
        </div>
      ))}
    </div>
  );
}
