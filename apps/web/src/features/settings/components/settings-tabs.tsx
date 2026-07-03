"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ResetDataActions } from "@/features/system";
import { OrganizationSettingsForm } from "./organization-settings-card";
import { BusinessHoursForm } from "./business-hours-card";

type Tab = "geral" | "horarios" | "dados";

const TABS: { value: Tab; label: string; description: string }[] = [
  {
    value: "geral",
    label: "Geral",
    description: "Dados gerais da organização e da unidade, exibidos no sistema.",
  },
  {
    value: "horarios",
    label: "Horários",
    description:
      "Define o expediente da unidade — usado para validar os agendamentos.",
  },
  {
    value: "dados",
    label: "Dados de exemplo",
    description:
      "Suas alterações ficam salvas no navegador (localStorage). Restaurar recarrega o catálogo de exemplo; zerar limpa tudo (mantendo só o Proprietário) para simular uma configuração inicial do zero.",
  },
];

/**
 * Configurações em abas: uma seção por vez (Geral / Horários / Dados). Os três
 * painéis ficam montados e alternamos só a visibilidade, para não descartar
 * edições em andamento ao trocar de aba.
 */
export function SettingsTabs() {
  const [tab, setTab] = useState<Tab>("geral");

  return (
    <div className="max-w-2xl">
      <div
        role="tablist"
        aria-label="Seções de configurações"
        className="mb-6 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {TABS.map((t) => {
          const active = t.value === tab;
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
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
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
          <p className="text-sm text-muted-foreground">{t.description}</p>
          {t.value === "geral" ? <OrganizationSettingsForm /> : null}
          {t.value === "horarios" ? <BusinessHoursForm /> : null}
          {t.value === "dados" ? <ResetDataActions /> : null}
        </div>
      ))}
    </div>
  );
}
