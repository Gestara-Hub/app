"use client";

import { isPossiblePhone } from "@gestarahub/core/phone";
import { useEffect, useRef } from "react";
import { useAppRouter } from "@/lib/use-app-router";
import { BRAZIL_TIME_ZONES, resolveSpaceTimeZone, timeZoneForState } from "@gestarahub/core/date";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { handleFormApiError } from "@/lib/form-errors";
import { Building2, MapPin } from "lucide-react";
import { AddressFields, InputPhone, InputText, SelectField, type SelectOption } from "@/components/form";
import {
  CLASSES_SEGMENT_PRESETS,
  CUSTOM_BILLING_OPTIONS,
  CUSTOM_PROGRESSION_OPTIONS,
  DEFAULT_CLASS_SEGMENT,
  DEFAULT_CUSTOM_BILLING,
  DEFAULT_CUSTOM_PROGRESSION,
} from "@/lib/business-segment-presets";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Address,
  ClassBillingMode,
  ClassesBusinessSegment,
  CustomSegmentProgression,
  Organization,
  Unit,
} from "@gestarahub/contracts";
import { useOrganization, useUnit, useUpdateOrganization, useUpdateUnit } from "../hooks/use-settings";
import { SettingsSaveBar } from "./settings-save-bar";
import { SettingsSection } from "./settings-section";
import { useReportDirty } from "./unsaved-changes";
import { syncSubaccountContactAction } from "@/services/onlinePayments/subaccountContactActions";

const addressSchema = z.object({
  postalCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const PHONE_INVALID = "Telefone inválido.";

const schema = z
  .object({
    organizationName: z.string().trim().min(1, "Informe o nome do espaço.").max(80, "Use até 80 caracteres."),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isPossiblePhone(v), { message: PHONE_INVALID }),
    address: addressSchema.optional(),
    timeZone: z.enum(BRAZIL_TIME_ZONES.map((z) => z.id) as [string, ...string[]]),
    classSegment: z.enum(
      Object.keys(CLASSES_SEGMENT_PRESETS) as [ClassesBusinessSegment, ...ClassesBusinessSegment[]],
    ),
    customSegmentName: z.string().trim().optional(),
    customSegmentProgression: z.enum(
      CUSTOM_PROGRESSION_OPTIONS.map((o) => o.value) as [CustomSegmentProgression, ...CustomSegmentProgression[]],
    ),
    customSegmentBilling: z.enum(
      CUSTOM_BILLING_OPTIONS.map((o) => o.value) as [ClassBillingMode, ...ClassBillingMode[]],
    ),
  })
  .superRefine((values, ctx) => {
    if (values.classSegment === "custom" && !values.customSegmentName) {
      ctx.addIssue({ code: "custom", path: ["customSegmentName"], message: "Informe o que você ensina." });
    }
  });
type GeneralValues = z.infer<typeof schema>;

// Opcoes curtas (25/11/2026): a lista de estados longa quebrava o campo em duas
// linhas; os estados do fuso escolhido vao na dica.
const TIME_ZONE_SHORT: Record<string, { label: string; states: string }> = {
  "America/Noronha": { label: "Fernando de Noronha (UTC−2)", states: "Vale para Fernando de Noronha." },
  "America/Sao_Paulo": { label: "Brasília (UTC−3)", states: "Vale para a maior parte do Brasil." },
  "America/Manaus": { label: "Manaus (UTC−4)", states: "Vale para AM, MT, MS, RO e RR." },
  "America/Rio_Branco": { label: "Rio Branco (UTC−5)", states: "Vale para o Acre e o oeste do Amazonas." },
};
const TIME_ZONE_OPTIONS: SelectOption[] = BRAZIL_TIME_ZONES.map((z) => ({
  value: z.id,
  label: TIME_ZONE_SHORT[z.id]?.label ?? z.label,
}));

const CLASS_SEGMENT_OPTIONS: SelectOption[] = Object.values(CLASSES_SEGMENT_PRESETS).map((p) => ({
  value: p.id,
  label: p.label,
}));

const CUSTOM_PROGRESSION_SELECT_OPTIONS: SelectOption[] = CUSTOM_PROGRESSION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const CUSTOM_BILLING_SELECT_OPTIONS: SelectOption[] = CUSTOM_BILLING_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function parseUnitAddress(addr: Unit["address"]): GeneralValues["address"] {
  const empty = { postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };
  if (!addr) return empty;
  if (typeof addr === "object") {
    return {
      postalCode: addr.postalCode ?? "",
      street: addr.street ?? "",
      number: addr.number ?? "",
      complement: addr.complement ?? "",
      neighborhood: addr.neighborhood ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
    };
  }
  return { ...empty, street: addr };
}

function GeneralForm({
  organization,
  unit,
  onDirtyChange,
}: {
  organization: Organization;
  unit: Unit;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const updateOrg = useUpdateOrganization();
  const updateUnit = useUpdateUnit();
  const router = useAppRouter();
  const pending = updateOrg.isPending || updateUnit.isPending;

  const form = useForm<GeneralValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      organizationName: organization.name,
      phone: unit.phone ?? "",
      address: parseUnitAddress(unit.address),
      timeZone: resolveSpaceTimeZone(organization.settings, unit.address),
      classSegment: organization.classSegment ?? DEFAULT_CLASS_SEGMENT,
      customSegmentName: organization.customSegmentName ?? "",
      customSegmentProgression: organization.customSegmentProgression ?? DEFAULT_CUSTOM_PROGRESSION,
      customSegmentBilling: organization.customSegmentBilling ?? DEFAULT_CUSTOM_BILLING,
    },
  });
  const dirty = form.formState.isDirty;
  useReportDirty(dirty, onDirtyChange);

  const isClasses = organization.model === "classes";
  const classSegment = useWatch({ control: form.control, name: "classSegment" });
  const state = useWatch({ control: form.control, name: "address.state" });
  const timeZone = useWatch({ control: form.control, name: "timeZone" });

  // Sem fuso escolhido, segue o estado do endereco (pode trocar, ex.: Noronha).
  // Acompanha enquanto o campo mostra a ultima sugestao (doc 07 §2.8: o
  // `isDirty` do RHF marcava o fuso sugerido como editado e ele parava de
  // acompanhar, salvando o fuso do estado anterior). Vai com `shouldDirty`
  // para o fuso sugerido ser salvo junto com o endereco.
  const lastSuggestedZone = useRef(form.getValues("timeZone"));
  useEffect(() => {
    if (organization.settings?.timeZone) return;
    if (form.getValues("timeZone") !== lastSuggestedZone.current) return;
    const suggested = timeZoneForState(state);
    if (!suggested || suggested === lastSuggestedZone.current) return;
    lastSuggestedZone.current = suggested;
    form.setValue("timeZone", suggested, { shouldDirty: true });
  }, [state, organization.settings?.timeZone, form]);

  // Telefone salvo que nao e telefone (ja aconteceu: 16 digitos): avisa ao abrir.
  // Mexeu no numero, o aviso sai; o novo e conferido ao salvar.
  const phone = useWatch({ control: form.control, name: "phone" });
  useEffect(() => {
    const saved = unit.phone?.trim();
    if (!saved || isPossiblePhone(saved)) return;
    if (phone === unit.phone) form.setError("phone", { message: `${PHONE_INVALID} Corrija e salve.` });
    else if (!form.formState.isSubmitted) form.clearErrors("phone");
  }, [phone, unit.phone, form]);

  // Deep link para o telefone (#phone, vindo da Comunicacao): foca o campo.
  useEffect(() => {
    if (window.location.hash !== "#phone") return;
    const el = document.getElementById("phone");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  }, []);

  const onSubmit = form.handleSubmit(
    async (values) => {
      // Grava so o que mudou, para cada salvamento virar um unico evento na auditoria.
      const changed = form.formState.dirtyFields;
      const segmentDirty = Boolean(
        changed.classSegment || changed.customSegmentName || changed.customSegmentProgression || changed.customSegmentBilling,
      );
      const orgDirty = Boolean(segmentDirty || changed.organizationName || changed.timeZone);
      const unitDirty = Boolean(changed.phone || changed.address);
      try {
        if (orgDirty) {
          const isCustom = values.classSegment === "custom";
          const customName = values.customSegmentName?.trim() ?? "";
          await updateOrg.mutateAsync({
            name: values.organizationName,
            ...(isClasses && segmentDirty
              ? {
                  classSegment: values.classSegment,
                  customSegmentName: isCustom ? customName : undefined,
                  customSegmentProgression: isCustom ? values.customSegmentProgression : undefined,
                  customSegmentBilling: isCustom ? values.customSegmentBilling : undefined,
                  segment: isCustom ? customName : CLASSES_SEGMENT_PRESETS[values.classSegment].label,
                }
              : {}),
            // O servico junta com o resto do que ja esta salvo.
            ...(changed.timeZone ? { settings: { timeZone: values.timeZone } } : {}),
          });
        }
        if (unitDirty) {
          await updateUnit.mutateAsync({ address: values.address as Address, phone: values.phone ?? "" });
        }
        // Telefone e endereco tambem no topo da fatura do parceiro (quem tem recebimentos online).
        const invoice =
          unitDirty && organization.settings?.onlinePayments?.gatewayAccountId
            ? await syncSubaccountContactAction().catch(() => ({ status: "failed" as const, message: undefined }))
            : { status: "skipped" as const };
        if (invoice.status === "failed") {
          toast.warning(
            `Configurações salvas. A fatura dos recebimentos online segue com o telefone e o endereço antigos${invoice.message ? `: ${invoice.message}` : "."}`,
          );
        } else if (invoice.status === "pending") {
          toast.success("Configurações salvas. O parceiro de pagamentos vai conferir o novo telefone e endereço da fatura.");
        } else if (invoice.status === "updated") {
          toast.success("Configurações salvas, também na fatura dos recebimentos online.");
        } else {
          toast.success("Configurações salvas.");
        }
        form.reset(values);
        // O fuso da sessao vem do servidor: recarrega o layout com o novo.
        if (changed.timeZone || changed.address) router.refresh();
      } catch (error) {
        handleFormApiError(error, form, "Não foi possível salvar as configurações.");
      }
    },
    () => toast.error("Revise os campos destacados."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <SettingsSection
          icon={<Building2 className="size-4" />}
          title="Dados do espaço"
          description="Nome, contato e área."
        >
          {/* Nome e area lado a lado; o telefone embaixo, na mesma grade (25/11/2026). */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputText<GeneralValues>
              name="organizationName"
              label="Nome do espaço"
              placeholder="Informe o nome do espaço"
              required
              disabled={pending}
            />
            {isClasses ? (
              <SelectField<GeneralValues>
                name="classSegment"
                label="Área do espaço"
                hint="Muda padrões de novas turmas e palavras das telas."
                options={CLASS_SEGMENT_OPTIONS}
                clearable={false}
                disabled={pending}
              />
            ) : null}
            <InputPhone<GeneralValues>
              id="phone"
              name="phone"
              label="Telefone / WhatsApp"
              placeholder="(11) 99999-9999"
              disabled={pending}
            />
          </div>
          {isClasses && classSegment === "custom" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputText<GeneralValues>
                name="customSegmentName"
                label="O que você ensina?"
                placeholder="Nome da sua área ou atividade"
                required
                disabled={pending}
              />
              <SelectField<GeneralValues>
                name="customSegmentProgression"
                label="Como seus alunos avançam?"
                hint="Muda a trilha sugerida e as palavras das telas."
                options={CUSTOM_PROGRESSION_SELECT_OPTIONS}
                clearable={false}
                disabled={pending}
              />
              <SelectField<GeneralValues>
                name="customSegmentBilling"
                label="Como você cobra?"
                hint="É só o padrão: cada turma pode cobrar diferente."
                options={CUSTOM_BILLING_SELECT_OPTIONS}
                clearable={false}
                disabled={pending}
              />
            </div>
          ) : null}
        </SettingsSection>

        <SettingsSection icon={<MapPin className="size-4" />} title="Endereço" description="Endereço e fuso horário.">
          <AddressFields<GeneralValues> prefix="address" disabled={pending} />
          {/* Largura inteira, alinhado com a grade do endereco (antes 2/3 de uma linha). */}
          <div>
            <SelectField<GeneralValues>
              name="timeZone"
              label="Fuso horário"
              hint={`${TIME_ZONE_SHORT[timeZone]?.states ?? ""} Define o dia e a hora de cobranças e aulas.`.trim()}
              options={TIME_ZONE_OPTIONS}
              clearable={false}
              disabled={pending}
            />
          </div>
        </SettingsSection>

        <SettingsSaveBar visible={dirty} onDiscard={() => form.reset()} pending={pending} />
      </form>
    </FormProvider>
  );
}

/** Aba "Geral": dados do espaço e endereço (as regras da mensalidade foram para "Cobrança"). */
export function OrganizationSettingsForm({
  onDirtyChange,
}: {
  /** Avisa as abas quando ha alteracoes nao salvas. */
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const orgQuery = useOrganization();
  const unitQuery = useUnit();

  if (!orgQuery.data || !unitQuery.data) {
    return (
      <div className="space-y-6 rounded-xl border border-border/60 bg-card p-7">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return <GeneralForm organization={orgQuery.data} unit={unitQuery.data} onDirtyChange={onDirtyChange} />;
}
