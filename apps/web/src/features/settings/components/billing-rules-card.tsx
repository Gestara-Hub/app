"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, FormProvider, useFormState, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Sparkles } from "lucide-react";
import type { Organization, Unit } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { InputNumber, SegmentedChoiceField, type SegmentedChoiceOption } from "@/components/form";
import { SectionSpotlight } from "@/components/shared/section-spotlight";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { useAttentionUntilInteraction } from "@/lib/use-attention-until-interaction";
import { useBusinessSegment, useOrganization, useUnit, useUpdateOrganization } from "../hooks/use-settings";
import { BillingRulesPreview } from "./billing-rules-preview";
import { SettingsSaveBar } from "./settings-save-bar";
import { SettingsSection } from "./settings-section";
import { useReportDirty } from "./unsaved-changes";

const MAX_DEFAULT_DUE_DAY = 31;

const schema = z.object({
  // 29 a 31 caem no ultimo dia dos meses mais curtos.
  defaultDueDay: z
    .number({ error: "Use um dia de 1 a 31." })
    .int("Use um dia de 1 a 31.")
    .min(1, "Use um dia de 1 a 31.")
    .max(MAX_DEFAULT_DUE_DAY, "Use um dia de 1 a 31."),
  billingTiming: z.enum(["prepaid", "postpaid"]),
  midMonthStrategy: z.enum(["prorated", "full_cycle"]),
});
type BillingValues = z.infer<typeof schema>;

const BILLING_TIMING_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prepaid", label: "Antecipado", description: "Paga antes das aulas" },
  { value: "postpaid", label: "Depois do uso", description: "Paga ao fim do período" },
];

const MID_MONTH_STRATEGY_OPTIONS: SegmentedChoiceOption[] = [
  { value: "prorated", label: "Proporcional", description: "Só os dias restantes" },
  { value: "full_cycle", label: "Mês cheio", description: "Vence no dia da matrícula" },
];

/** Ancora das regras na URL (a configuracao inicial chega por ela). */
export const BILLING_RULES_ANCHOR = "billing-rules";

/**
 * Ancoras do hash. Tolera hash repetido (`#billing-rules#billing-rules`), que o
 * roteador do Next ja produziu em navegacoes seguidas para o mesmo destino.
 */
export function hashTargets(hash: string): string[] {
  return hash.split("#").filter(Boolean);
}

function SettingRow({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-6">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function toValues(organization: Organization): BillingValues {
  return {
    defaultDueDay: Math.min(organization.settings?.defaultDueDay ?? 10, MAX_DEFAULT_DUE_DAY),
    billingTiming: organization.settings?.billingTiming ?? "prepaid",
    midMonthStrategy: organization.settings?.midMonthStrategy ?? "prorated",
  };
}

function BillingRulesForm({
  organization,
  unit,
  onDirtyChange,
}: {
  organization: Organization;
  unit: Unit;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const updateOrg = useUpdateOrganization();
  const pending = updateOrg.isPending;
  const form = useForm<BillingValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toValues(organization),
  });
  const dirty = form.formState.isDirty;
  useReportDirty(dirty, onDirtyChange);
  const dueDayError = useFormState({ control: form.control, name: "defaultDueDay" }).errors.defaultDueDay?.message;

  // Regras da mensalidade so pedem confirmacao em area de mensalidade (curso,
  // pacote e sem cobranca nao usam). Pendente nao e alteracao nao salva.
  const usesMembership = useBusinessSegment().defaultBillingMode === "membership";
  const hasBusinessHours = unit.businessHours.some((day) => !day.closed);
  const isBillingUnconfirmed = usesMembership && hasBusinessHours && !organization.settings?.billingTiming;

  const currentTiming = useWatch({ control: form.control, name: "billingTiming" });
  const currentStrategy = useWatch({ control: form.control, name: "midMonthStrategy" });
  const currentDueDay = useWatch({ control: form.control, name: "defaultDueDay" });
  const isValidDueDay =
    Number.isInteger(currentDueDay) && currentDueDay >= 1 && currentDueDay <= MAX_DEFAULT_DUE_DAY;

  // O painel fica montado nas outras abas, e a navegacao do Next (ex.: o
  // "Continuar" da configuracao inicial vindo de Horarios) troca a URL via
  // pushState, sem disparar `hashchange`. Por isso reage tambem aos search params.
  const searchParams = useSearchParams();
  // Chegou pelo link da configuracao inicial: o cartao pulsa ate o usuario
  // tocar, focar ou abrir algo nele. Cada chegada rearma o pulso.
  const [arrival, setArrival] = useState(0);
  const sectionAttention = useAttentionUntilInteraction(isBillingUnconfirmed && arrival > 0, arrival);
  // O botao de confirmar pulsa ate o clique enquanto as regras nao foram confirmadas.
  const confirmAttention = useAttentionUntilInteraction(isBillingUnconfirmed, "billing-confirm");
  const sectionRef = useRef<HTMLElement>(null);
  // Destaque cobre a secao e a barra com "Confirmar regras recomendadas".
  const saveBarRef = useRef<HTMLDivElement>(null);
  const spotlightRefs = useMemo(() => [sectionRef, saveBarRef], []);
  useEffect(() => {
    let timer: number | undefined;
    const handleHash = () => {
      if (!isBillingUnconfirmed) return;
      if (!hashTargets(window.location.hash).includes(BILLING_RULES_ANCHOR)) return;
      setArrival((n) => n + 1);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = document.getElementById(BILLING_RULES_ANCHOR);
        if (!el || el.closest("[hidden]")) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", handleHash);
    };
  }, [searchParams, isBillingUnconfirmed]);

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        // O servico junta com o resto do que ja esta salvo (fuso, recebimentos...).
        await updateOrg.mutateAsync({
          settings: {
            defaultDueDay: values.defaultDueDay,
            billingTiming: values.billingTiming,
            midMonthStrategy: values.midMonthStrategy,
          },
        });
        toast.success(isBillingUnconfirmed ? "Regras da mensalidade confirmadas com sucesso." : "Regras da mensalidade salvas.");
        if (window.location.hash) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
        setArrival(0);
        form.reset(values);
      } catch (error) {
        toast.error(getErrorMessage(error, "Não foi possível salvar as regras da mensalidade."));
      }
    },
    () => toast.error("Revise os campos destacados."),
  );

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          confirmAttention.stop();
          void onSubmit(event);
        }}
        noValidate
      >
        <SettingsSection
          ref={sectionRef}
          id={BILLING_RULES_ANCHOR}
          data-tour="settings-billing-rules"
          icon={<CalendarDays className="size-4" />}
          title="Regras da mensalidade"
          description="Só para mensalidades. Curso, pacote e avulso têm valor e vencimento próprios."
          className="scroll-mt-20"
        >
          {isBillingUnconfirmed ? (
            <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>Este é o modelo mais comum. Se servir para você, é só confirmar.</p>
            </div>
          ) : null}
          <div className="divide-y divide-border/40">
            <SettingRow label="Momento do pagamento" hint="Quando a mensalidade vence.">
              <SegmentedChoiceField<BillingValues>
                name="billingTiming"
                ariaLabel="Momento do pagamento"
                options={BILLING_TIMING_OPTIONS}
                disabled={pending}
              />
            </SettingRow>
            <SettingRow label="Entrada no meio do mês" hint="Como fica a 1ª cobrança.">
              <SegmentedChoiceField<BillingValues>
                name="midMonthStrategy"
                ariaLabel="Entrada no meio do mês"
                options={MID_MONTH_STRATEGY_OPTIONS}
                disabled={pending}
              />
            </SettingRow>
            <SettingRow
              label="Dia de vencimento"
              required={currentStrategy !== "full_cycle"}
              hint={
                currentStrategy === "full_cycle"
                  ? "Vence todo mês no dia da matrícula."
                  : "Todos os alunos vencem no mesmo dia."
              }
            >
              {currentStrategy === "full_cycle" ? (
                <div className="flex items-center gap-2 py-1 text-sm font-medium text-foreground">
                  <span className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Automático (dia da matrícula)
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Todo dia</span>
                  {/* O erro sai numa linha propria: dentro do campo de 80px
                      quebrava em 3 linhas. */}
                  <div className="w-20 [&_[role=alert]]:hidden">
                    <InputNumber<BillingValues>
                      name="defaultDueDay"
                      min={1}
                      max={MAX_DEFAULT_DUE_DAY}
                      disabled={pending}
                    />
                  </div>
                  <span>de cada mês</span>
                  {dueDayError ? (
                    <span role="alert" className="basis-full text-xs text-destructive">
                      {dueDayError}
                    </span>
                  ) : null}
                  {isValidDueDay && currentDueDay >= 29 ? (
                    <span className="basis-full text-xs">Nos meses mais curtos, vence no último dia.</span>
                  ) : null}
                </div>
              )}
            </SettingRow>
          </div>
          <BillingRulesPreview
            billingTiming={currentTiming}
            midMonthStrategy={currentStrategy}
            defaultDueDay={isValidDueDay ? currentDueDay : 10}
          />
        </SettingsSection>
        <SectionSpotlight
          active={sectionAttention.attention}
          targetRefs={spotlightRefs}
          onDismiss={sectionAttention.stop}
        />
        <SettingsSaveBar
          ref={saveBarRef}
          // Enquanto o passo esta pendente, a barra fica para confirmar as regras.
          visible={dirty || isBillingUnconfirmed}
          status={isBillingUnconfirmed && !dirty ? "Falta confirmar" : undefined}
          onDiscard={dirty ? () => form.reset() : undefined}
          saveLabel={
            isBillingUnconfirmed ? (dirty ? "Confirmar regras" : "Confirmar regras recomendadas") : "Salvar"
          }
          pending={pending}
          attention={confirmAttention.attention}
        />
      </form>
    </FormProvider>
  );
}

/** Aba "Cobrança": as regras da mensalidade (antes um bloco da aba Geral). */
export function BillingRulesCard({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void } = {}) {
  const orgQuery = useOrganization();
  const unitQuery = useUnit();
  if (!orgQuery.data || !unitQuery.data) {
    return (
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return <BillingRulesForm organization={orgQuery.data} unit={unitQuery.data} onDirtyChange={onDirtyChange} />;
}
