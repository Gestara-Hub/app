"use client";

import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { Award, Check, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import type { CertificateTemplate } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import {
  CERTIFICATE_ACCENT_COLORS,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_LIMITS,
  CERTIFICATE_VARIABLES,
  validateCertificateTemplate,
  type CertificateVariable,
} from "@gestarahub/core/certificate";
import { todayISO } from "@gestarahub/core/date";
import {
  FileDropField,
  InputText,
  SegmentedChoiceField,
  SwitchField,
  TextArea,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { CERTIFICATE_LOGO_RULES, filesSchema, fileIssue } from "@/lib/files";
import { handleFormApiError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { useCan, useHasFeature } from "@/features/auth";
import {
  ACCENT_COLORS,
  CertificateSheet,
  LAYOUT_OPTIONS,
  VARIABLE_LABELS,
  sampleCertificate,
  useCertificateTemplate,
  useLocalFileUrl,
  useResetCertificateTemplate,
  useSaveCertificateTemplate,
  useStoredFileUrl,
} from "@/features/certificates";
import { useOrganization, useUnit } from "../hooks/use-settings";
import { UnsavedChangesStatus, useReportDirty } from "./unsaved-changes";

/** Texto do upsell (uma linha, como os outros recursos do Pro). */
export const CERTIFICATE_TEMPLATE_LOCKED_HINT = "Modelo de certificado no Plano Profissional.";

const BODY_ID = "certificate-body";

const schema = z
  .object({
    layout: z.enum(CERTIFICATE_LAYOUTS),
    accentColor: z.enum(CERTIFICATE_ACCENT_COLORS),
    title: z.string(),
    body: z.string(),
    signatures: z.array(z.object({ name: z.string(), role: z.string() })),
    showAttendance: z.boolean(),
    /** A logo salva continua (o usuario nao clicou em "Remover"). */
    keepLogo: z.boolean(),
    logo: filesSchema(CERTIFICATE_LOGO_RULES),
  })
  // Mesmas regras do servico (titulo, texto, assinaturas e variaveis), numa fonte so.
  .superRefine((values, ctx) => {
    for (const issue of validateCertificateTemplate(values)) {
      ctx.addIssue({
        code: "custom",
        path: issue.field.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
        message: issue.message,
      });
    }
  });
type Values = z.infer<typeof schema>;

function toValues(template: CertificateTemplate): Values {
  return {
    layout: template.layout,
    accentColor: template.accentColor,
    title: template.title,
    body: template.body,
    signatures: template.signatures.map((s) => ({ ...s })),
    showAttendance: template.showAttendance,
    keepLogo: Boolean(template.logoFileId),
    logo: [],
  };
}

/**
 * Configuracoes -> "Certificado" (Plano Profissional): o modelo do certificado de
 * conclusao do espaco, com previa ao vivo. Sem o recurso mostra o upsell.
 */
export function CertificateTemplateCard({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const hasFeature = useHasFeature();
  const can = useCan();
  const query = useCertificateTemplate();

  if (!hasFeature("certificates")) {
    // Bloqueado: na largura das outras abas (a aba aberta usa a largura da previa).
    return (
      <div className="max-w-3xl">
        <FeatureLocked
          title="Modelo de certificado"
          description={CERTIFICATE_TEMPLATE_LOCKED_HINT}
          icon={<Award className="size-7" aria-hidden />}
          canManagePlan={can("subscription:manage")}
          align="start"
        />
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="aspect-[297/210] w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o modelo.</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <CertificateTemplateForm
      key={query.data.updatedAt ?? "default"}
      template={query.data}
      onDirtyChange={onDirtyChange}
    />
  );
}

function AccentColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: Values["accentColor"];
  onChange: (value: Values["accentColor"]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
      {CERTIFICATE_ACCENT_COLORS.map((key) => {
        const selected = key === value;
        const { label, hex } = ACCENT_COLORS[key];
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-background ring-1 ring-border transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "ring-2 ring-foreground",
            )}
            style={{ backgroundColor: hex }}
          >
            {selected ? <Check className="size-4 text-white" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

function CertificateTemplateForm({
  template,
  onDirtyChange,
}: {
  template: CertificateTemplate;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const save = useSaveCertificateTemplate();
  const reset = useResetCertificateTemplate();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const { data: organization } = useOrganization();
  const { data: unit } = useUnit();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toValues(template),
  });
  const signatures = useFieldArray({ control: form.control, name: "signatures" });
  const dirty = form.formState.isDirty;
  useReportDirty(dirty, onDirtyChange);
  const pending = save.isPending || reset.isPending;

  const values = useWatch({ control: form.control }) as Values;
  const newLogo = values.logo?.[0];
  const newLogoOk = newLogo && !fileIssue(newLogo, CERTIFICATE_LOGO_RULES) ? newLogo : undefined;
  const newLogoUrl = useLocalFileUrl(newLogoOk);
  const savedLogoUrl = useStoredFileUrl(template.logoFileId);
  const logoUrl = newLogoUrl ?? (values.keepLogo ? savedLogoUrl : null);

  const address = unit?.address;
  const sample = sampleCertificate({
    organizationName: organization?.name,
    city: typeof address === "object" ? address?.city : undefined,
    today: todayISO(),
  });

  // Insere a variavel onde esta o cursor do texto (ou no fim).
  function insertVariable(variable: CertificateVariable) {
    const token = `{${variable}}`;
    const el = document.getElementById(BODY_ID) as HTMLTextAreaElement | null;
    const body = form.getValues("body");
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    form.setValue("body", next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    requestAnimationFrame(() => {
      // Digitou antes deste quadro: o cursor ja e o da pessoa.
      if (!el || el.value !== next) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const saved = await save.mutateAsync({
        template: {
          layout: v.layout,
          accentColor: v.accentColor,
          title: v.title,
          body: v.body,
          signatures: v.signatures,
          showAttendance: v.showAttendance,
        },
        keepLogoFileId: v.keepLogo ? template.logoFileId : undefined,
        logoFile: v.logo[0],
      });
      toast.success("Modelo de certificado salvo.");
      form.reset(toValues(saved));
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o modelo.");
    }
  });

  async function restoreDefault() {
    const ok = await confirm({
      title: "Restaurar o modelo padrão?",
      description: "Layout, cor, texto, assinaturas e logo voltam ao padrão.",
      confirmLabel: "Restaurar",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const saved = await reset.mutateAsync();
      toast.success("Modelo padrão restaurado.");
      form.reset(toValues(saved));
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível restaurar o modelo."));
    }
  }

  const canRestore = Boolean(template.updatedAt) || dirty;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Layout</Label>
                  <SegmentedChoiceField<Values>
                    name="layout"
                    options={LAYOUT_OPTIONS}
                    ariaLabel="Layout"
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Cor</Label>
                  <AccentColorPicker
                    value={values.accentColor}
                    onChange={(next) => form.setValue("accentColor", next, { shouldDirty: true })}
                    disabled={pending}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Texto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputText<Values>
                  name="title"
                  label="Título"
                  required
                  placeholder="Informe o título"
                  disabled={pending}
                />
                <div className="space-y-1.5">
                  <TextArea<Values>
                    id={BODY_ID}
                    name="body"
                    label="Texto"
                    required
                    rows={5}
                    placeholder="Escreva o texto do certificado"
                    hint={`Trecho com informação que falta sai do texto. Até ${CERTIFICATE_LIMITS.body} caracteres.`}
                    disabled={pending}
                  />
                  <div className="flex flex-wrap gap-1" aria-label="Inserir variável">
                    {CERTIFICATE_VARIABLES.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        disabled={pending}
                        onClick={() => insertVariable(variable)}
                        className="cursor-pointer rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
                      >
                        + {VARIABLE_LABELS[variable]}
                      </button>
                    ))}
                  </div>
                </div>
                <SwitchField<Values>
                  name="showAttendance"
                  label="Mostrar frequência"
                  hint="Desligada, o trecho da frequência sai."
                  disabled={pending}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assinaturas</CardTitle>
                <CardDescription>Use {"{professor}"} ou {"{empresa}"} para o nome automático.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {signatures.fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                      <InputText<Values>
                        id={`signature-${index}-name`}
                        name={`signatures.${index}.name`}
                        label="Nome"
                        required
                        placeholder="Informe o nome"
                        disabled={pending}
                      />
                      <InputText<Values>
                        id={`signature-${index}-role`}
                        name={`signatures.${index}.role`}
                        label="Cargo"
                        placeholder="Informe o cargo"
                        disabled={pending}
                      />
                    </div>
                    {signatures.fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 shrink-0"
                        aria-label="Remover assinatura"
                        disabled={pending}
                        onClick={() => signatures.remove(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {signatures.fields.length < CERTIFICATE_LIMITS.maxSignatures ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() => signatures.append({ name: "", role: "" })}
                  >
                    <Plus className="size-4" />
                    Adicionar assinatura
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent>
                {values.keepLogo && template.logoFileId ? (
                  <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    {savedLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
                      <img src={savedLogoUrl} alt="" className="size-10 shrink-0 rounded-md border bg-white object-contain" />
                    ) : (
                      <Skeleton className="size-10 shrink-0 rounded-md" />
                    )}
                    <p className="flex-1 text-sm text-foreground">Logo atual</p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5"
                      disabled={pending}
                      onClick={() => form.setValue("keepLogo", false, { shouldDirty: true })}
                    >
                      <Trash2 className="size-4" />
                      Remover
                    </Button>
                  </div>
                ) : (
                  <FileDropField<Values>
                    name="logo"
                    multiple={false}
                    disabled={pending}
                    {...CERTIFICATE_LOGO_RULES}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2 lg:sticky lg:top-20">
            <p className="text-sm font-medium text-foreground">Prévia</p>
            <CertificateSheet certificate={sample} template={values} logoUrl={logoUrl} />
            <p className="text-xs text-muted-foreground">Dados de exemplo.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <UnsavedChangesStatus dirty={dirty} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={pending || !canRestore}
              onClick={() => void restoreDefault()}
            >
              <RotateCcw className="size-4" />
              Restaurar padrão
            </Button>
            <Button type="submit" disabled={pending} className="min-w-36">
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      {confirmDialog}
    </FormProvider>
  );
}
