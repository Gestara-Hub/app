"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { ResetDataActions } from "@/features/system";
import { OrganizationSettingsForm, hashTargets } from "./organization-settings-card";
import { BusinessHoursForm } from "./business-hours-card";
import { useBeforeUnloadGuard } from "./unsaved-changes";

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
    label: "Dados",
    icon: Database,
    description:
      "Os dados desta demonstração ficam salvos neste navegador. Apagar tudo remove alunos, turmas, cobranças e demais cadastros e mantém só os proprietários iniciais.",
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep-link: `/settings?tab=horarios` ou `/settings?tab=geral` deriva diretamente da URL
  const paramTab = searchParams.get("tab");
  const tab: Tab = isTab(paramTab) ? paramTab : "geral";

  // Rola até a seção com âncora hash (ex.: #billing-rules) quando a aba Geral estiver ativa
  useEffect(() => {
    if (tab === "geral" && typeof window !== "undefined" && window.location.hash) {
      const [hash] = hashTargets(window.location.hash);
      const el = hash ? document.getElementById(hash) : null;
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    }
  }, [tab]);

  // Abas com alteracoes nao salvas (Geral e Horarios avisam via onDirtyChange)
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<Tab, boolean>>>({});
  const setGeralDirty = useCallback(
    (dirty: boolean) => setDirtyTabs((prev) => (prev.geral === dirty ? prev : { ...prev, geral: dirty })),
    [],
  );
  const setHorariosDirty = useCallback(
    (dirty: boolean) =>
      setDirtyTabs((prev) => (prev.horarios === dirty ? prev : { ...prev, horarios: dirty })),
    [],
  );
  useBeforeUnloadGuard(Boolean(dirtyTabs.geral || dirtyTabs.horarios));
  const { confirm, dialog: confirmDialog } = useConfirmAction();

  const handleTabChange = async (nextTab: Tab) => {
    if (nextTab === tab) return;
    if (dirtyTabs[tab]) {
      const current = TABS.find((t) => t.value === tab)?.label ?? "";
      const ok = await confirm({
        title: "Alterações não salvas",
        description: `Você alterou a aba ${current} e ainda não salvou. As alterações ficam guardadas até você sair da página, mas não valem enquanto não forem salvas.`,
        confirmLabel: "Trocar de aba",
        cancelLabel: "Continuar editando",
      });
      if (!ok) return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
              onClick={() => void handleTabChange(t.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
              {dirtyTabs[t.value] ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
                  <span className="sr-only">(alterações não salvas)</span>
                </>
              ) : null}
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
          {t.value === "geral" ? <OrganizationSettingsForm onDirtyChange={setGeralDirty} /> : null}
          {t.value === "horarios" ? <BusinessHoursForm onDirtyChange={setHorariosDirty} /> : null}
          {t.value === "dados" ? <ResetDataActions /> : null}
        </div>
      ))}
      {confirmDialog}
    </div>
  );
}
