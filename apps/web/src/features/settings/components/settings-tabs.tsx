"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Clock, Sparkles } from "lucide-react";
import { PageTabs } from "@/components/shared/page-tabs";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useModel } from "@/features/auth";
import { OrganizationSettingsForm } from "./organization-settings-card";
import { BusinessHoursForm } from "./business-hours-card";
import { BILLING_RULES_ANCHOR, BillingRulesCard, hashTargets } from "./billing-rules-card";
import { useBeforeUnloadGuard, useLeaveLinkGuard } from "./unsaved-changes";
import { SubscriptionPlanCard } from "./subscription-plan-card";

type Tab = "geral" | "horarios" | "cobranca" | "plano";

/** Abas que editam e salvam pela barra (o Plano tem acoes proprias). */
type EditableTab = Exclude<Tab, "plano">;

const TABS: {
  value: Tab;
  label: string;
  icon: typeof Building2;
  /** So nos espacos de turmas (cobranca por mensalidade). */
  classesOnly?: boolean;
}[] = [
  { value: "geral", label: "Geral", icon: Building2 },
  { value: "horarios", label: "Horários", icon: Clock },
  { value: "cobranca", label: "Cobrança", icon: CalendarDays, classesOnly: true },
  { value: "plano", label: "Plano GestaraHub", icon: Sparkles },
];

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.value === value);
}

/** Uma linha sob as abas (a Geral dispensa: os blocos ja dizem o que sao). */
function tabDescription(tab: Tab, isClasses: boolean): string | null {
  switch (tab) {
    case "horarios":
      return isClasses
        ? "Dias e horários em que o espaço funciona. As turmas seguem esse horário."
        : "Dias e horários em que o espaço funciona. A agenda segue esse horário.";
    case "cobranca":
      return "Como a mensalidade dos alunos vence.";
    case "plano":
      return "Sua assinatura do GestaraHub.";
    default:
      return null;
  }
}

/**
 * Configurações em abas: Geral, Horários, Cobrança e Plano. As preferências de
 * cada pessoa (tema e sons) ficam só no menu da conta; os modelos de
 * certificado ficam na tela Certificados (menu lateral). Os painéis ficam
 * montados e alternamos só a visibilidade, para não descartar edições em
 * andamento ao trocar de aba.
 */
export function SettingsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isClasses = useModel() === "classes";
  const visibleTabs = TABS.filter((t) => !t.classesOnly || isClasses);
  const paramTab = searchParams.get("tab");
  // Deep link: `/settings?tab=horarios`; aba que nao existe (ex.: a antiga
  // "preferencias") abre a Geral.
  const tab: Tab =
    isTab(paramTab) && visibleTabs.some((t) => t.value === paramTab) ? paramTab : "geral";

  // Links antigos das regras (`/settings#billing-rules`, `?tab=geral#billing-rules`)
  // levam para a aba Cobranca, onde as regras ficam desde 31/10/2026.
  useEffect(() => {
    if (!isClasses || tab === "cobranca") return;
    if (!hashTargets(window.location.hash).includes(BILLING_RULES_ANCHOR)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "cobranca");
    router.replace(`${pathname}?${params.toString()}#${BILLING_RULES_ANCHOR}`, { scroll: false });
  }, [isClasses, tab, pathname, router, searchParams]);

  // Abas com alteracoes nao salvas (cada formulario avisa via onDirtyChange).
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<EditableTab, boolean>>>({});
  const reportDirty = useCallback(
    (key: EditableTab) => (dirty: boolean) =>
      setDirtyTabs((prev) => (Boolean(prev[key]) === dirty ? prev : { ...prev, [key]: dirty })),
    [],
  );
  const [onDirty] = useState(() => ({
    geral: reportDirty("geral"),
    horarios: reportDirty("horarios"),
    cobranca: reportDirty("cobranca"),
  }));
  const anyDirty = Object.values(dirtyTabs).some(Boolean);
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
    if (tab !== "plano" && dirtyTabs[tab]) {
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
    <div className="max-w-5xl">
      <PageTabs
        tabs={visibleTabs.map((t) => ({
          ...t,
          extra:
            t.value !== "plano" && dirtyTabs[t.value] ? (
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

      {visibleTabs.map((t) => {
        const description = tabDescription(t.value, isClasses);
        return (
          <div
            key={t.value}
            role="tabpanel"
            id={`settings-panel-${t.value}`}
            aria-labelledby={`settings-tab-${t.value}`}
            hidden={t.value !== tab}
            className="space-y-4"
          >
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            {t.value === "geral" ? <OrganizationSettingsForm onDirtyChange={onDirty.geral} /> : null}
            {t.value === "horarios" ? <BusinessHoursForm onDirtyChange={onDirty.horarios} /> : null}
            {t.value === "cobranca" ? <BillingRulesCard onDirtyChange={onDirty.cobranca} /> : null}
            {t.value === "plano" ? <SubscriptionPlanCard /> : null}
          </div>
        );
      })}
      {confirmDialog}
    </div>
  );
}
