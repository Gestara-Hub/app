"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, Building2, Clock, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageTabs } from "@/components/shared/page-tabs";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useModel } from "@/features/auth";
import { UserPreferencesView } from "@/features/preferences";
import { OrganizationSettingsForm } from "./organization-settings-card";
import { BusinessHoursForm } from "./business-hours-card";
import { useBeforeUnloadGuard, useLeaveLinkGuard } from "./unsaved-changes";
import { SubscriptionPlanCard } from "./subscription-plan-card";
import { CertificateTemplateCard } from "./certificate-template-card";

type Tab = "geral" | "horarios" | "certificado" | "plano" | "preferencias";

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
      "Dias e horários em que o espaço funciona. Turmas e agenda seguem esse horário.",
  },
  {
    value: "certificado",
    label: "Certificado",
    icon: Award,
    description: "Modelo do certificado de conclusão dos cursos.",
  },
  {
    value: "plano",
    label: "Plano GestaraHub",
    icon: Sparkles,
    description:
      "O plano do GestaraHub desta organização e o que o Pro inclui. Não confundir com os planos de mensalidade dos alunos.",
  },
  {
    value: "preferencias",
    label: "Preferências",
    icon: SlidersHorizontal,
    description:
      "Aparência da interface, modos padrão de visualização de listas, paginação e feedback sonoro.",
  },
];

/**
 * Configurações em abas: uma seção por vez (Geral / Horários / Pagamento online / Certificado / Plano / Dados). Os
 * painéis ficam montados e alternamos só a visibilidade, para não descartar
 * edições em andamento ao trocar de aba.
 */
function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.value === value);
}

export function SettingsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep-link: `/settings?tab=horarios` ou `/settings?tab=geral` deriva diretamente da URL
  // Certificado é do Modelo 3 (turmas e cursos).
  const isClasses = useModel() === "classes";
  const visibleTabs = TABS.filter(
    (t) => t.value !== "certificado" || isClasses,
  );
  const paramTab = searchParams.get("tab");
  const tab: Tab =
    isTab(paramTab) && visibleTabs.some((t) => t.value === paramTab) ? paramTab : "geral";

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
  const setCertificadoDirty = useCallback(
    (dirty: boolean) =>
      setDirtyTabs((prev) => (prev.certificado === dirty ? prev : { ...prev, certificado: dirty })),
    [],
  );
  const anyDirty = Boolean(dirtyTabs.geral || dirtyTabs.horarios || dirtyTabs.certificado);
  useBeforeUnloadGuard(anyDirty);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // Sair pelo menu com alteracoes nao salvas pergunta antes (antes perdia tudo).
  const askLeave = useCallback(
    () =>
      confirm({
        title: "Sair sem salvar?",
        description: "As alterações não salvas desta tela serão perdidas.",
        confirmLabel: "Sair sem salvar",
        cancelLabel: "Continuar editando",
        highlightAction: "cancel",
      }),
    [confirm],
  );
  useLeaveLinkGuard(anyDirty, askLeave);

  const handleTabChange = async (nextTab: Tab) => {
    if (nextTab === tab) return;
    if (dirtyTabs[tab]) {
      const current = TABS.find((t) => t.value === tab)?.label ?? "";
      const ok = await confirm({
        title: "Alterações não salvas",
        description: `Você tem alterações não salvas na aba ${current}. Deseja continuar editando?`,
        confirmLabel: "Trocar de aba",
        cancelLabel: "Continuar editando",
        highlightAction: "cancel",
      });
      if (!ok) return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    const targetUrl = `${pathname}?${params.toString()}`;
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", targetUrl);
    }
    router.replace(targetUrl, { scroll: false });
  };

  return (
    // O editor do certificado usa duas colunas (campos e previa): aba mais larga.
    <div className={tab === "certificado" ? "max-w-6xl" : "max-w-3xl"}>
      <PageTabs
        tabs={visibleTabs.map((t) => ({
          ...t,
          extra: dirtyTabs[t.value] ? (
            <>
              <span aria-hidden className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="sr-only">(alterações não salvas)</span>
            </>
          ) : null,
        }))}
        value={tab}
        onChange={(value) => void handleTabChange(value)}
        label="Seções de configurações"
        idPrefix="settings"
        className="mb-6"
      />

      {visibleTabs.map((t) => (
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
          {t.value === "certificado" ? (
            <CertificateTemplateCard onDirtyChange={setCertificadoDirty} />
          ) : null}
          {t.value === "plano" ? <SubscriptionPlanCard /> : null}
          {t.value === "preferencias" ? (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <UserPreferencesView />
            </div>
          ) : null}
        </div>
      ))}
      {confirmDialog}
    </div>
  );
}
