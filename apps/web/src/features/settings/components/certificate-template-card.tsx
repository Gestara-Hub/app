"use client";

import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { Award, Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import type { CertificatePart, CertificateTemplate, Id } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import {
  CERTIFICATE_ACCENT_COLORS,
  CERTIFICATE_INKS,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_LIMITS,
  CERTIFICATE_PARTS,
  CERTIFICATE_TEXT_POSITIONS,
  CERTIFICATE_VARIABLES,
  DEFAULT_CERTIFICATE_BODY,
  DEFAULT_CERTIFICATE_TITLE,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureLocked } from "@/components/shared/feature-locked";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { CERTIFICATE_ARTWORK_RULES, CERTIFICATE_LOGO_RULES, filesSchema, fileIssue } from "@/lib/files";
import { handleFormApiError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { useCan, useHasFeature } from "@/features/auth";
import { useCategories } from "@/features/categories";
import {
  ACCENT_COLORS,
  CertificateSheet,
  INK_OPTIONS,
  LAYOUT_OPTIONS,
  PART_LABELS,
  TEXT_POSITION_OPTIONS,
  VARIABLE_LABELS,
  sampleCertificate,
  useCertificateTemplate,
  useLocalFileUrl,
  useModalitiesWithOwnTemplate,
  useRemoveModalityTemplate,
  useSaveCertificateTemplate,
  useStoredFileUrl,
} from "@/features/certificates";
import { useOrganization, useUnit } from "../hooks/use-settings";
import { SettingsSaveBar } from "./settings-save-bar";
import { useReportDirty } from "./unsaved-changes";

/** Texto do upsell (uma linha, como os outros recursos do Pro). */
export const CERTIFICATE_TEMPLATE_LOCKED_HINT = "Modelo de certificado no Plano Profissional.";

const BODY_ID = "certificate-body";

/**
 * Quem assina (31/10/2026): escolha em vez de digitar {professor} ou {empresa}.
 * O modelo continua guardando o nome com a variavel; "Outro nome" e texto livre.
 */
type Signer = "teacher" | "space" | "custom";
const SIGNER_NAMES: Record<Exclude<Signer, "custom">, string> = {
  teacher: "{professor}",
  space: "{empresa}",
};
const SIGNER_OPTIONS: { value: Signer; label: string }[] = [
  { value: "teacher", label: "Professor da turma" },
  { value: "space", label: "Nome do espaço" },
  { value: "custom", label: "Outro nome" },
];

function signerOf(name: string): Signer {
  const trimmed = name.trim();
  if (trimmed === SIGNER_NAMES.teacher) return "teacher";
  if (trimmed === SIGNER_NAMES.space) return "space";
  return "custom";
}

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
    /** "Minha arte": a arte salva continua; `artwork` e o arquivo novo. */
    keepArtwork: z.boolean(),
    artwork: filesSchema(CERTIFICATE_ARTWORK_RULES),
    textPosition: z.enum(CERTIFICATE_TEXT_POSITIONS),
    ink: z.enum(CERTIFICATE_INKS),
    hidden: z.array(z.enum(CERTIFICATE_PARTS)),
  })
  // Mesmas regras do servico (titulo, texto, assinaturas, variaveis e arte), numa fonte so.
  .superRefine((values, ctx) => {
    const hasArtwork = values.keepArtwork || values.artwork.length > 0;
    const issues = validateCertificateTemplate({
      ...values,
      artwork: { fileId: hasArtwork ? "pending" : "", textPosition: values.textPosition, ink: values.ink, hidden: values.hidden },
    });
    for (const issue of issues) {
      // Os ajustes da arte sao campos soltos no formulario (`artwork.hidden` -> `hidden`);
      // "artwork" sozinho e o campo do arquivo.
      const field = issue.field.startsWith("artwork.") ? issue.field.slice("artwork.".length) : issue.field;
      ctx.addIssue({
        code: "custom",
        path: field.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
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
    keepArtwork: Boolean(template.artwork?.fileId),
    artwork: [],
    textPosition: template.artwork?.textPosition ?? "center",
    ink: template.artwork?.ink ?? "dark",
    hidden: template.artwork?.hidden ?? [],
  };
}

/** Os ajustes da arte, como a folha e o servico esperam. */
function artworkOf(values: Pick<Values, "textPosition" | "ink" | "hidden">, fileId = "") {
  return { fileId, textPosition: values.textPosition, ink: values.ink, hidden: values.hidden };
}

const SPACE = "space";

/**
 * Configuracoes -> "Certificado" (Plano Profissional): o modelo do certificado de
 * conclusao do espaco, ou o de uma modalidade ("Vale para", 31/10/2026), com
 * previa ao vivo. Sem o recurso mostra o upsell.
 */
export function CertificateTemplateCard({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const hasFeature = useHasFeature();
  const can = useCan();
  const [modalityId, setModalityId] = useState<Id | undefined>(undefined);
  const query = useCertificateTemplate(modalityId);
  const modalities = useCategories({ status: "active" });
  const own = useModalitiesWithOwnTemplate();
  const removeOwn = useRemoveModalityTemplate();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // Trocar de modalidade com alteracao nao salva pergunta antes (o formulario recomeca).
  // Memorizado: o formulario reage a troca do callback (uma funcao nova a cada
  // desenho virava um laco de renderizacao).
  const [dirty, setDirty] = useState(false);
  const reportDirty = useCallback(
    (next: boolean) => {
      setDirty(next);
      onDirtyChange?.(next);
    },
    [onDirtyChange],
  );

  async function changeScope(value: string) {
    const next = value === SPACE ? undefined : value;
    if (next === modalityId) return;
    if (dirty) {
      const ok = await confirm({
        title: "Alterações não salvas",
        description: "Trocar de modelo descarta o que você mudou aqui.",
        confirmLabel: "Trocar mesmo assim",
        cancelLabel: "Continuar editando",
        highlightAction: "cancel",
      });
      if (!ok) return;
    }
    setModalityId(next);
  }

  async function backToSpaceTemplate() {
    if (!modalityId) return;
    const name = modalities.data?.find((c) => c.id === modalityId)?.name ?? "a modalidade";
    const ok = await confirm({
      title: "Usar o modelo do espaço?",
      description: `${name} deixa de ter modelo próprio; os cursos dela saem com o modelo do espaço.`,
      confirmLabel: "Usar o do espaço",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    removeOwn.mutate(modalityId, {
      onSuccess: () => toast.success(`${name} voltou ao modelo do espaço.`),
      onError: (error) => toast.error(getErrorMessage(error, "Não foi possível voltar ao modelo do espaço.")),
    });
  }

  const ownIds = new Set(own.data ?? []);
  const scopePicker = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 space-y-1.5">
        <Label htmlFor="certificate-scope">Vale para</Label>
        <Select value={modalityId ?? SPACE} onValueChange={(value) => void changeScope(value)}>
          <SelectTrigger id="certificate-scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SPACE}>Todo o espaço</SelectItem>
            {(modalities.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {ownIds.has(c.id) ? `${c.name} · modelo próprio` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {modalityId ? (
        ownIds.has(modalityId) ? (
          <button
            type="button"
            disabled={removeOwn.isPending}
            onClick={() => void backToSpaceTemplate()}
            className="inline-flex cursor-pointer items-center gap-1 pb-2.5 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="size-3" aria-hidden />
            Usar o modelo do espaço
          </button>
        ) : (
          <p className="pb-2.5 text-xs text-muted-foreground">Usa o modelo do espaço. Mude algo e salve para ter o próprio.</p>
        )
      ) : null}
    </div>
  );

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
    <div className="space-y-4">
      {scopePicker}
      {confirmDialog}
      <CertificateTemplateForm
        key={`${modalityId ?? SPACE}:${query.data.updatedAt ?? "default"}:${ownIds.has(modalityId ?? "") ? "own" : "space"}`}
        template={query.data}
        modalityId={modalityId}
        onDirtyChange={reportDirty}
      />
    </div>
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
  modalityId,
  onDirtyChange,
}: {
  template: CertificateTemplate;
  /** Modelo so desta modalidade; sem ele, o do espaco. */
  modalityId?: Id;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const save = useSaveCertificateTemplate();
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
  const pending = save.isPending;

  const values = useWatch({ control: form.control }) as Values;
  const newLogo = values.logo?.[0];
  const newLogoOk = newLogo && !fileIssue(newLogo, CERTIFICATE_LOGO_RULES) ? newLogo : undefined;
  const newLogoUrl = useLocalFileUrl(newLogoOk);
  const savedLogoUrl = useStoredFileUrl(template.logoFileId);
  const logoUrl = newLogoUrl ?? (values.keepLogo ? savedLogoUrl : null);
  const isCustom = values.layout === "custom";
  const newArtwork = values.artwork?.[0];
  const newArtworkOk = newArtwork && !fileIssue(newArtwork, CERTIFICATE_ARTWORK_RULES) ? newArtwork : undefined;
  const newArtworkUrl = useLocalFileUrl(newArtworkOk);
  const savedArtworkUrl = useStoredFileUrl(template.artwork?.fileId);
  const artworkUrl = newArtworkUrl ?? (values.keepArtwork ? savedArtworkUrl : null);
  const hidden = values.hidden ?? [];
  const togglePart = (part: CertificatePart, shown: boolean) =>
    form.setValue("hidden", shown ? hidden.filter((p) => p !== part) : [...hidden, part], {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });

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
          ...(v.layout === "custom" ? { artwork: artworkOf(v, v.keepArtwork ? template.artwork?.fileId : "") } : {}),
        },
        keepLogoFileId: v.keepLogo ? template.logoFileId : undefined,
        logoFile: v.logo[0],
        artworkFile: v.layout === "custom" ? v.artwork[0] : undefined,
        modalityId,
      });
      toast.success("Modelo de certificado salvo.");
      form.reset(toValues(saved));
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível salvar o modelo.");
    }
  });

  // Volta o titulo e o texto padrao no rascunho; quem grava e o "Salvar" da barra.
  async function restoreDefaultText() {
    const ok = await confirm({
      title: "Voltar ao texto padrão?",
      description: "O título e o texto do certificado voltam ao padrão. Salve para valer.",
      confirmLabel: "Voltar ao padrão",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    form.setValue("title", DEFAULT_CERTIFICATE_TITLE, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    form.setValue("body", DEFAULT_CERTIFICATE_BODY, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }

  const textIsDefault = values.title === DEFAULT_CERTIFICATE_TITLE && values.body === DEFAULT_CERTIFICATE_BODY;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Campos numa coluna estreita; a previa fica com o resto da tela (pedido de 31/10/2026). */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Layout</Label>
                  {/* Cartoes 2x2: na coluna estreita do editor, 4 opcoes lado a lado ficavam espremidas. */}
                  <SegmentedChoiceField<Values>
                    name="layout"
                    options={LAYOUT_OPTIONS}
                    ariaLabel="Layout"
                    variant="cards"
                    disabled={pending}
                  />
                </div>
                {!isCustom ? (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Cor</Label>
                    <AccentColorPicker
                      value={values.accentColor}
                      onChange={(next) => form.setValue("accentColor", next, { shouldDirty: true })}
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {isCustom ? (
              <Card>
                <CardHeader>
                  <CardTitle>Arte de fundo</CardTitle>
                  <CardDescription>Sua imagem cobre a folha; o texto do modelo fica por cima.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {values.keepArtwork && template.artwork?.fileId ? (
                    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                      {savedArtworkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- object URL local, sem otimizacao do Next
                        <img src={savedArtworkUrl} alt="" className="h-10 w-14 shrink-0 rounded-md border bg-white object-cover" />
                      ) : (
                        <Skeleton className="h-10 w-14 shrink-0 rounded-md" />
                      )}
                      <p className="flex-1 text-sm text-foreground">Arte atual</p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-1.5"
                        disabled={pending}
                        onClick={() => form.setValue("keepArtwork", false, { shouldDirty: true })}
                      >
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <FileDropField<Values> name="artwork" multiple={false} disabled={pending} {...CERTIFICATE_ARTWORK_RULES} />
                      <p className="text-xs text-muted-foreground">Folha deitada (A4). A imagem é esticada para cobrir a folha.</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Posição do texto</Label>
                    <SegmentedChoiceField<Values>
                      name="textPosition"
                      options={TEXT_POSITION_OPTIONS}
                      ariaLabel="Posição do texto"
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Cor do texto</Label>
                    <SegmentedChoiceField<Values> name="ink" options={INK_OPTIONS} ariaLabel="Cor do texto" disabled={pending} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Partes que aparecem</Label>
                    <p className="text-xs text-muted-foreground">Desligue o que a sua arte já traz impresso.</p>
                    <ul className="divide-y rounded-lg border">
                      {CERTIFICATE_PARTS.map((part) => {
                        const shown = !hidden.includes(part);
                        return (
                          <li key={part} className="flex items-center justify-between gap-3 px-3 py-2">
                            <Label htmlFor={`artwork-part-${part}`} className="text-sm font-normal">
                              {PART_LABELS[part]}
                            </Label>
                            <Switch
                              id={`artwork-part-${part}`}
                              checked={shown}
                              disabled={pending}
                              onCheckedChange={(next) => togglePart(part, next)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {form.formState.errors.hidden?.message ? (
                      <p role="alert" className="text-xs text-destructive">
                        {String(form.formState.errors.hidden.message)}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Texto</CardTitle>
                {!textIsDefault ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void restoreDefaultText()}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    Voltar ao texto padrão
                  </button>
                ) : null}
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
                  hint="Inclui a frequência no texto."
                  disabled={pending}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assinaturas</CardTitle>
                <CardDescription>O professor da turma e o nome do espaço saem de cada curso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {signatures.fields.map((field, index) => {
                  const signer = signerOf(values.signatures?.[index]?.name ?? "");
                  return (
                  <div key={field.id} className="flex items-start gap-2">
                    {/* "Quem assina" na linha toda: na coluna estreita do editor o nome cortava. */}
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`signature-${index}-signer`}>Quem assina</Label>
                        <Select
                          value={signer}
                          disabled={pending}
                          onValueChange={(next) =>
                            form.setValue(
                              `signatures.${index}.name`,
                              next === "custom" ? "" : SIGNER_NAMES[next as Exclude<Signer, "custom">],
                              { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
                            )
                          }
                        >
                          <SelectTrigger id={`signature-${index}-signer`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SIGNER_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {signer === "custom" ? (
                        <InputText<Values>
                          id={`signature-${index}-name`}
                          name={`signatures.${index}.name`}
                          label="Nome"
                          required
                          placeholder="Informe o nome"
                          disabled={pending}
                        />
                      ) : null}
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
                  );
                })}
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
            <CertificateSheet
              certificate={sample}
              template={{ ...values, artwork: artworkOf(values) }}
              logoUrl={logoUrl}
              artworkUrl={artworkUrl}
            />
            <p className="text-xs text-muted-foreground">Dados de exemplo.</p>
          </div>
        </div>

        <SettingsSaveBar visible={dirty} onDiscard={() => form.reset()} pending={pending} />
      </form>
      {confirmDialog}
    </FormProvider>
  );
}
