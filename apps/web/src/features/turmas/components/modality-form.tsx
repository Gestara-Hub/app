"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, FormProvider, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Award,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { InputText, SwitchField } from "@/components/form";
import { BeltBadge } from "@/components/shared/belt-badge";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BELT_COLOR_META,
  CRITERIA_TYPE_LABELS,
  PROGRESSION_TEMPLATES,
  extractTipColorFromText,
  resolveTrackStyle,
  trackUsesAges,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import type {
  Category,
  CreateCategory,
  ModalityProgressionTrack,
  ProgressionBeltColor,
  ProgressionCriteriaType,
  ProgressionLevelStep,
  ProgressionTrackTemplateKey,
} from "@gestarahub/contracts";
import { segmentDefaultTrack } from "@/lib/business-segment-presets";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useCreateCategory, useUpdateCategory } from "@/features/categories";
import { useBusinessSegment } from "@/features/settings";
import { modalityFormSchema, type ModalityFormValues } from "../modality-schema";

const QUICK_MODALITY_SUGGESTIONS = [
  "Jiu-Jitsu",
  "No-Gi / Submission",
  "Muay Thai",
  "Boxe",
  "Judô",
  "Karatê",
  "Kickboxing",
  "Taekwondo",
  "Capoeira",
  "MMA",
  "Wrestling",
  "Krav Maga",
] as const;

function toDefaults(modality?: Category): ModalityFormValues {
  return {
    name: modality?.name ?? "",
    active: modality ? modality.status === "active" : true,
  };
}

const BELT_COLORS = Object.keys(BELT_COLOR_META) as ProgressionBeltColor[];
/** Cores do estilo nivel: as mesmas, sem a "Neutra" (sem cor ja e o neutro). */
const LEVEL_COLORS = BELT_COLORS.filter((c) => c !== "slate");
const NO_COLOR = "none";
/** Campo de idade compacto, sem as setinhas do input numerico. */
const AGE_INPUT_CLASS =
  "h-7 w-16 px-2 text-base tabular-nums md:text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

type TemplateKey = Exclude<ProgressionTrackTemplateKey, "custom">;
const ALL_TEMPLATE_KEYS = Object.keys(PROGRESSION_TEMPLATES) as TemplateKey[];

function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(PROGRESSION_TEMPLATES, value);
}

/** Assinatura comparavel da trilha: niveis e metas (ignora ids e o rotulo do modelo). */
function trackSignature(t: ModalityProgressionTrack): string {
  return JSON.stringify({
    criteriaType: t.criteriaType,
    targetAttendances: t.targetAttendances,
    targetMonths: t.targetMonths,
    levels: t.levels.map((l) => [l.name.trim(), l.color ?? null, l.tipColor ?? null, l.maxSubLevels, l.minAge ?? null, l.maxAge ?? null]),
  });
}

/** A trilha foi personalizada (difere de todos os modelos)? */
function isCustomizedTrack(t: ModalityProgressionTrack): boolean {
  const signature = trackSignature(t);
  return !ALL_TEMPLATE_KEYS.some((k) => trackSignature(PROGRESSION_TEMPLATES[k].track) === signature);
}

interface ModalityFormProps {
  modality?: Category;
  onSuccess: () => void;
  formId: string;
}

export function ModalityForm({ modality, onSuccess, formId }: ModalityFormProps) {
  const isEdit = Boolean(modality);
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const pending = createMut.isPending || updateMut.isPending;
  const segment = useBusinessSegment();
  const { vocabulary } = segment;
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  const [showLevelsEditor, setShowLevelsEditor] = useState(false);
  const [isCustomizePulsing, setIsCustomizePulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const triggerCustomizePulse = () => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
    }
    setIsCustomizePulsing(true);
    pulseTimerRef.current = setTimeout(() => {
      setIsCustomizePulsing(false);
    }, 3600);
  };

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const [track, setTrack] = useState<ModalityProgressionTrack>(() => {
    if (modality?.progressionTrack) {
      return structuredClone(modality.progressionTrack);
    }
    return segmentDefaultTrack(segment, modality?.name ?? "");
  });

  const form = useForm<ModalityFormValues>({
    resolver: zodResolver(modalityFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: toDefaults(modality),
  });

  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";

  // Faixa etaria por nivel: ligada quando a trilha ja tem idade (ex.: modelo
  // de Jiu-Jitsu) ou quando o usuario liga o interruptor.
  const [agesEnabled, setAgesEnabled] = useState(false);
  const showAges = agesEnabled || trackUsesAges(track);

  // Estilo vem da trilha (faixa nas lutas, nivel nas demais), nao da area.
  const trackStyle = resolveTrackStyle(track);
  const isBelt = trackStyle === "belt";
  // "Faixa" so no estilo faixa; numa trilha de niveis de uma academia de luta
  // (ex.: Yoga) a palavra vira "Nível".
  const levelWord = isBelt ? "Faixa" : vocabulary.level === "Faixa" ? "Nível" : vocabulary.level;
  const levelPluralWord = isBelt
    ? "Faixas"
    : vocabulary.level === "Faixa"
      ? "Níveis"
      : vocabulary.levelPlural;
  const quickSuggestions: readonly string[] =
    segment.id === "martial_arts" ? QUICK_MODALITY_SUGGESTIONS : segment.defaultModalities;
  const suggestedTemplates = segment.trackTemplates;
  const otherTemplates = ALL_TEMPLATE_KEYS.filter((k) => !suggestedTemplates.includes(k));

  async function applyTemplate(key: TemplateKey) {
    if (key === track.templateKey || !isTemplateKey(key)) return;
    // So pergunta quando ha personalizacao de verdade (niveis ou metas diferentes
    // de qualquer modelo); trocar entre modelos intactos e direto.
    if (
      isCustomizedTrack(track) &&
      !(await confirmAction({
        title: "Trocar o modelo da trilha?",
        description: "Os níveis e metas que você personalizou serão substituídos pelos do modelo.",
        confirmLabel: "Trocar modelo",
      }))
    ) {
      return;
    }
    const next = structuredClone(PROGRESSION_TEMPLATES[key].track);
    setTrack({ ...next, enabled: true });
  }

  const handleSelectQuickSuggestion = (suggestion: string) => {
    form.setValue("name", suggestion, {
      shouldValidate: true,
      shouldDirty: true,
    });
    const inferred = segmentDefaultTrack(segment, suggestion);
    setTrack(inferred);
    if (inferred.enabled) {
      triggerCustomizePulse();
    } else {
      setIsCustomizePulsing(false);
    }
  };

  const criteriaSummaryText =
    track.criteriaType === "attendance"
      ? `evolução a cada ${track.targetAttendances ?? 24} aulas`
      : track.criteriaType === "time"
        ? `evolução a cada ${track.targetMonths ?? 6} meses`
        : track.criteriaType === "attendance_and_time"
          ? `evolução a cada ${track.targetAttendances ?? 30} aulas e ${track.targetMonths ?? 6} meses`
          : "avaliação do professor";

  const updateStep = (index: number, patch: Partial<ProgressionLevelStep>) => {
    setTrack((prev) => ({
      ...prev,
      templateKey: "custom",
      levels: prev.levels.map((step, i) => {
        if (i !== index) return step;
        const nextStep = { ...step, ...patch };
        if (isBelt && patch.name !== undefined && patch.tipColor === undefined && nextStep.color) {
          const detectedTip = extractTipColorFromText(
            patch.name,
            nextStep.color,
          );
          nextStep.tipColor = detectedTip ?? undefined;
        }
        return nextStep;
      }),
    }));
  };

  const reorderSteps = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setTrack((prev) => {
      if (toIndex >= prev.levels.length) return prev;
      const next = [...prev.levels];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return { ...prev, templateKey: "custom", levels: next };
    });
  };

  const removeStep = (index: number) => {
    setTrack((prev) => ({
      ...prev,
      templateKey: "custom",
      levels: prev.levels.filter((_, i) => i !== index),
    }));
  };

  const addStep = () => {
    setShowLevelsEditor(true);
    setTrack((prev) => ({
      ...prev,
      templateKey: "custom",
      levels: [
        ...prev.levels,
        isBelt
          ? {
              id: `lvl-${Date.now()}`,
              name: `Faixa ${prev.levels.length + 1}`,
              color: "blue",
              maxSubLevels: 4,
            }
          : {
              id: `lvl-${Date.now()}`,
              name: `${levelWord} ${prev.levels.length + 1}`,
              maxSubLevels: 0,
            },
      ],
    }));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (track.enabled && track.levels.length === 0) {
      toast.error(`Adicione pelo menos 1 etapa na ${vocabulary.trackTitle.toLowerCase()} ou desligue a trilha.`);
      return;
    }

    const sanitizedTrack: ModalityProgressionTrack = {
      ...track,
      style: trackStyle,
      levels: track.levels.map((l, idx) => ({
        ...l,
        name: l.name.trim() || `${levelWord} ${idx + 1}`,
        // Estilo nivel: sem ponta e sem subniveis (graus sao so das faixas).
        ...(isBelt ? {} : { tipColor: undefined, maxSubLevels: 0 }),
      })),
    };

    try {
      if (isEdit && modality) {
        await updateMut.mutateAsync({
          id: modality.id,
          payload: {
            name: values.name,
            progressionTrack: sanitizedTrack,
            status: values.active ? "active" : "inactive",
          },
        });
        toast.success("Modalidade atualizada com sucesso.");
      } else {
        const payload: CreateCategory = {
          name: values.name,
          progressionTrack: sanitizedTrack,
        };
        await createMut.mutateAsync(payload);
        toast.success("Modalidade criada com sucesso.");
      }
      onSuccess();
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<ModalityFormValues>, {
            message: f.message,
          });
        }
      } else {
        toast.error(
          getErrorMessage(error, "Não foi possível salvar a modalidade."),
        );
      }
    }
  });

  const showAttendanceGoal =
    track.criteriaType === "attendance" ||
    track.criteriaType === "attendance_and_time";
  const showTimeGoal =
    track.criteriaType === "time" ||
    track.criteriaType === "attendance_and_time";

  return (
    <FormProvider {...form}>
      {confirmDialog}
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-3.5">
          <div className="space-y-2">
            <InputText<ModalityFormValues>
              name="name"
              label="Nome da modalidade"
              placeholder="Informe o nome da modalidade"
              required
              disabled={pending}
            />

            {!isEdit && quickSuggestions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-muted-foreground mr-0.5">
                  Sugestões:
                </span>
                {quickSuggestions.map((suggestion) => {
                  const isSelected =
                    watchedName.trim().toLowerCase() ===
                    suggestion.toLowerCase();
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={pending}
                      onClick={() => handleSelectQuickSuggestion(suggestion)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span>+ {suggestion}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Bloco da trilha de progresso (titulo conforme a area) */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Award className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {vocabulary.trackTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ordem de evolução e meta para avaliação dos alunos.
                  </p>
                </div>
              </div>
              <Switch
                checked={track.enabled}
                onCheckedChange={(checked) => {
                  if (checked && track.templateKey !== "custom") {
                    const inferred = segmentDefaultTrack(segment, watchedName);
                    setTrack({ ...inferred, enabled: true });
                  } else {
                    setTrack((prev) => ({ ...prev, enabled: checked }));
                  }
                  if (checked) {
                    triggerCustomizePulse();
                  } else {
                    setIsCustomizePulsing(false);
                  }
                }}
                disabled={pending}
                aria-label={`Ativar ${vocabulary.trackTitle.toLowerCase()}`}
              />
            </div>

            {track.enabled ? (
              <div className="space-y-3 pt-2.5 border-t border-border/50">
                {/* Preview visual limpo (1 olhar, sem caixas aninhadas) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {track.levels.map((step, idx) => (
                    <span
                      key={step.id}
                      className="inline-flex items-center gap-1"
                    >
                      <BeltBadge
                        levelName={step.name || levelWord}
                        color={step.color}
                        variant={trackStyle}
                        tipColor={step.tipColor ?? null}
                        subLevel={step.maxSubLevels}
                        maxSubLevels={step.maxSubLevels}
                        subLevelLabelMode="count"
                        size="xs"
                      />
                      {idx < track.levels.length - 1 ? (
                        <span className="text-[10px] text-muted-foreground/50">
                          →
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>

                {/* Barra destacada de resumo da regra + botão Personalizar com pulso temporário */}
                {/* No celular empilha: regra em cima (texto inteiro), botao embaixo. */}
                <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-background px-2.5 py-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                    <span className="font-medium text-muted-foreground shrink-0">
                      Regra atual:
                    </span>
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                      {criteriaSummaryText}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsCustomizePulsing(false);
                      setShowLevelsEditor((prev) => !prev);
                    }}
                    className={cn(
                      "h-8 w-full px-2 text-[11px] font-semibold border-primary/35 text-primary hover:bg-primary/10 hover:text-primary shrink-0 sm:h-7 sm:w-auto",
                      !showLevelsEditor &&
                        isCustomizePulsing &&
                        "motion-safe:animate-attention-ring",
                    )}
                  >
                    {showLevelsEditor ? (
                      <>
                        Concluir personalização
                        <ChevronUp className="size-3.5" />
                      </>
                    ) : (
                      <>
                        Personalizar regras e níveis
                        <ChevronDown className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Painel expansível: Critério/Meta + Editor de Níveis */}
                {showLevelsEditor ? (
                  <div className="space-y-3 pt-2.5 border-t border-border/50">
                    {/* Modelo da trilha: os da area primeiro */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Modelo
                      </label>
                      <Select
                        value={track.templateKey ?? "custom"}
                        onValueChange={(val) => {
                          // O Select pode emitir "" (ex.: quando a opcao "Personalizado"
                          // some da lista); so modelos conhecidos sao aplicados.
                          if (isTemplateKey(val)) void applyTemplate(val);
                        }}
                      >
                        <SelectTrigger className="h-8 w-full bg-background text-xs">
                          <SelectValue>
                            {track.templateKey && track.templateKey !== "custom"
                              ? (PROGRESSION_TEMPLATES[track.templateKey]?.label ?? "Personalizado")
                              : "Personalizado"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {track.templateKey === "custom" ? (
                            <SelectItem value="custom" className="text-xs" disabled>
                              Personalizado
                            </SelectItem>
                          ) : null}
                          <SelectGroup>
                            <SelectLabel className="text-[10px]">Sugeridos</SelectLabel>
                            {suggestedTemplates.map((key) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {PROGRESSION_TEMPLATES[key].label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px]">Outros modelos</SelectLabel>
                            {otherTemplates.map((key) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {PROGRESSION_TEMPLATES[key].label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Critério e meta para avançar */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {isBelt
                          ? "Quando troca de faixa ou grau"
                          : `Quando avança de ${levelWord.toLowerCase()}`}
                      </label>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <Select
                          value={track.criteriaType}
                          onValueChange={(val) =>
                            setTrack((prev) => ({
                              ...prev,
                              criteriaType: val as ProgressionCriteriaType,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 w-full flex-1 bg-background text-xs min-w-0">
                            <SelectValue>
                              {CRITERIA_TYPE_LABELS[track.criteriaType]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(
                                CRITERIA_TYPE_LABELS,
                              ) as ProgressionCriteriaType[]
                            ).map((crit) => (
                              <SelectItem
                                key={crit}
                                value={crit}
                                className="text-xs"
                              >
                                {CRITERIA_TYPE_LABELS[crit]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {showAttendanceGoal ? (
                          <div
                            className="relative shrink-0 w-24"
                            title="Meta de presenças"
                          >
                            <Input
                              type="number"
                              min={1}
                              max={500}
                              value={track.targetAttendances ?? 30}
                              onChange={(e) =>
                                setTrack((prev) => ({
                                  ...prev,
                                  targetAttendances: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                }))
                              }
                              className="h-8 bg-background pr-11 text-xs tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                              aulas
                            </span>
                          </div>
                        ) : null}

                        {showTimeGoal ? (
                          <div
                            className="relative shrink-0 w-24"
                            title="Tempo mínimo em meses"
                          >
                            <Input
                              type="number"
                              min={1}
                              max={120}
                              value={track.targetMonths ?? 6}
                              onChange={(e) =>
                                setTrack((prev) => ({
                                  ...prev,
                                  targetMonths: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                }))
                              }
                              className="h-8 bg-background pr-12 text-xs tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                              meses
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Lista de níveis editáveis */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          {levelPluralWord} da trilha ({track.levels.length})
                        </label>
                        <label className="ml-auto mr-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Switch
                            checked={showAges}
                            onCheckedChange={(checked) => {
                              setAgesEnabled(checked);
                              // Desligar apaga as idades: a trilha volta a valer para todos.
                              // Sem idade cadastrada, nao ha o que apagar (nao vira "personalizado").
                              if (!checked && trackUsesAges(track)) {
                                setTrack((prev) => ({
                                  ...prev,
                                  templateKey: "custom",
                                  levels: prev.levels.map((l) => ({ ...l, minAge: undefined, maxAge: undefined })),
                                }));
                              }
                            }}
                            aria-label="Definir idade por nível"
                            className="scale-75"
                          />
                          Idade por {levelWord.toLowerCase()}
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addStep}
                          className="h-6 px-2 text-[11px]"
                        >
                          <Plus className="size-3" />
                          Adicionar {levelWord.toLowerCase()}
                        </Button>
                      </div>
                    <div className="divide-y divide-border/60 rounded-lg border bg-background overflow-hidden">
                      {track.levels.map((step, index) => (
                        <div
                          key={step.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedIndex(index);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (
                              draggedIndex !== null &&
                              draggedIndex !== index
                            ) {
                              reorderSteps(draggedIndex, index);
                              setDraggedIndex(index);
                            }
                            if (dragOverIndex !== index) {
                              setDragOverIndex(index);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDraggedIndex(null);
                            setDragOverIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedIndex(null);
                            setDragOverIndex(null);
                          }}
                          className={cn(
                            "flex flex-wrap items-center gap-1.5 px-2 py-1.5 transition-colors",
                            draggedIndex === index
                              ? "bg-primary/10 opacity-80"
                              : "hover:bg-muted/25",
                          )}
                        >
                          <span
                            className="inline-flex items-center gap-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground shrink-0"
                            title="Arraste para reordenar"
                          >
                            <GripVertical className="size-3.5" />
                            <span className="w-4 text-center text-[11px] font-semibold text-muted-foreground tabular-nums">
                              {index + 1}º
                            </span>
                          </span>

                          <Input
                            value={step.name}
                            onChange={(e) =>
                              updateStep(index, { name: e.target.value })
                            }
                            onDragStart={(e) => e.stopPropagation()}
                            draggable={false}
                            placeholder={vocabulary.levelName}
                            className="h-7 min-w-[130px] flex-1 border-transparent bg-transparent px-2 text-xs shadow-none hover:border-input focus:border-input focus:bg-background"
                          />

                          {isBelt ? (
                            <>
                            {/* Seletor Múltiplo de Cores (Até 2 cores: 1ª Faixa, 2ª Ponta) */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-30 shrink-0 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2 text-xs shadow-2xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  title="Selecionar até 2 cores (1ª Faixa, 2ª Ponta)"
                                >
                                  <span className="inline-flex items-center gap-1.5 min-w-0">
                                    <span className="inline-flex items-center shrink-0">
                                      <span
                                        className={cn(
                                          "size-2.5 rounded-full shrink-0",
                                          BELT_COLOR_META[step.color ?? "slate"]
                                            ?.swatchClass,
                                        )}
                                      />
                                      {step.tipColor &&
                                      step.tipColor !== step.color ? (
                                        <span
                                          className={cn(
                                            "-ml-1 size-2.5 rounded-full shrink-0 ring-1 ring-background",
                                            BELT_COLOR_META[step.tipColor]
                                              ?.swatchClass,
                                          )}
                                        />
                                      ) : null}
                                    </span>
                                    <span className="truncate">
                                      {step.tipColor &&
                                      step.tipColor !== step.color
                                        ? `${BELT_COLOR_META[step.color ?? "slate"]?.label}/${BELT_COLOR_META[step.tipColor]?.label}`
                                        : BELT_COLOR_META[step.color ?? "slate"]?.label}
                                    </span>
                                  </span>
                                  <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                onWheel={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                className="w-60 p-2 space-y-1.5"
                              >
                                <div className="flex items-center justify-between px-1 pb-1 border-b border-border/60">
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    Até 2 cores (1ª Faixa • 2ª Ponta)
                                  </span>
                                  {step.tipColor &&
                                  step.tipColor !== step.color ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateStep(index, { tipColor: undefined })
                                      }
                                      className="text-[10px] font-medium text-primary hover:underline"
                                    >
                                      Só 1 cor
                                    </button>
                                  ) : null}
                                </div>

                                <div className="grid grid-cols-1 gap-0.5 max-h-80 overflow-y-auto overscroll-contain">
                                  {BELT_COLORS.map((colorKey) => {
                                    const isPrimary = step.color === colorKey;
                                    const isTip =
                                      step.tipColor === colorKey &&
                                      step.tipColor !== step.color;
                                    const isSelected = isPrimary || isTip;

                                    const handleToggleColor = () => {
                                      if (isTip) {
                                        // Clicou na 2ª cor -> desmarca a ponta
                                        updateStep(index, {
                                          tipColor: undefined,
                                        });
                                      } else if (isPrimary) {
                                        // Clicou na 1ª cor -> se tiver 2ª cor, a 2ª vira a 1ª cor
                                        if (
                                          step.tipColor &&
                                          step.tipColor !== step.color
                                        ) {
                                          updateStep(index, {
                                            color: step.tipColor,
                                            tipColor: undefined,
                                          });
                                        }
                                      } else {
                                        // Clicou em uma cor não selecionada -> entra como 2ª cor (ponta)
                                        updateStep(index, {
                                          tipColor: colorKey,
                                        });
                                      }
                                    };

                                    return (
                                      <div
                                        key={colorKey}
                                        className={cn(
                                          "group flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors",
                                          isSelected
                                            ? "bg-primary/10 text-foreground font-medium"
                                            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                                        )}
                                      >
                                        <button
                                          type="button"
                                          onClick={handleToggleColor}
                                          className="flex flex-1 items-center gap-2 text-left min-w-0"
                                        >
                                          <span
                                            className={cn(
                                              "size-3 rounded-full shrink-0",
                                              BELT_COLOR_META[colorKey]
                                                .swatchClass,
                                            )}
                                          />
                                          <span className="truncate">
                                            {BELT_COLOR_META[colorKey].label}
                                          </span>
                                        </button>

                                        {isPrimary ? (
                                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary shrink-0">
                                            1ª Faixa
                                          </span>
                                        ) : isTip ? (
                                          <button
                                            type="button"
                                            onClick={handleToggleColor}
                                            className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground hover:bg-destructive/15 hover:text-destructive shrink-0"
                                            title="Clique para remover a ponta"
                                          >
                                            2ª Ponta ×
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateStep(index, {
                                                  color: colorKey,
                                                  tipColor:
                                                    step.tipColor === colorKey
                                                      ? undefined
                                                      : step.tipColor,
                                                })
                                              }
                                              className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/50"
                                              title="Definir como 1ª cor (principal)"
                                            >
                                              1ª
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleToggleColor}
                                              className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/50"
                                              title="Definir como 2ª cor (ponta)"
                                            >
                                              2ª
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Graus da faixa */}
                            {(() => {
                              const unit = "graus";
                              const zeroLabel = "Sem graus";
                              return (
                                <Select
                                  value={String(step.maxSubLevels)}
                                  onValueChange={(val) =>
                                    updateStep(index, {
                                      maxSubLevels: Number(val),
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-25 shrink-0 text-xs px-2">
                                    <SelectValue>
                                      {step.maxSubLevels === 0
                                        ? zeroLabel
                                        : `${step.maxSubLevels} ${unit}`}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[0, 2, 3, 4, 5, 6].map((g) => (
                                      <SelectItem
                                        key={g}
                                        value={String(g)}
                                        className="text-xs"
                                      >
                                        {g === 0 ? zeroLabel : `${g} ${unit}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                            </>
                          ) : (
                            /* Estilo nivel: uma cor opcional, sem ponta e sem graus */
                            <Select
                              value={step.color ?? NO_COLOR}
                              onValueChange={(val) =>
                                updateStep(index, {
                                  color: val === NO_COLOR ? undefined : (val as ProgressionBeltColor),
                                })
                              }
                            >
                              <SelectTrigger className="h-7 w-30 shrink-0 text-xs px-2" aria-label="Cor do nível">
                                <SelectValue>
                                  <span className="inline-flex items-center gap-1.5">
                                    {step.color ? (
                                      <span
                                        className={cn(
                                          "size-2.5 rounded-full shrink-0",
                                          BELT_COLOR_META[step.color].swatchClass,
                                        )}
                                      />
                                    ) : null}
                                    {step.color ? BELT_COLOR_META[step.color].label : "Sem cor"}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_COLOR} className="text-xs">
                                  Sem cor
                                </SelectItem>
                                {LEVEL_COLORS.map((colorKey) => (
                                  <SelectItem key={colorKey} value={colorKey} className="text-xs">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span
                                        className={cn(
                                          "size-2.5 rounded-full shrink-0",
                                          BELT_COLOR_META[colorKey].swatchClass,
                                        )}
                                      />
                                      {BELT_COLOR_META[colorKey].label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}


                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-destructive/80 hover:text-destructive"
                            disabled={track.levels.length <= 1}
                            onClick={() => removeStep(index)}
                            aria-label={`Remover ${levelWord.toLowerCase()}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>

                          {/* Faixa etaria em linha propria (sem espremer a linha do nivel) */}
                          {showAges ? (
                            <div className="flex basis-full items-center gap-2 pb-0.5 pl-9 text-xs text-muted-foreground">
                              <span className="font-medium">Idade</span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={120}
                                value={step.minAge ?? ""}
                                onChange={(e) =>
                                  updateStep(index, {
                                    minAge: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                                  })
                                }
                                placeholder="de"
                                aria-label={`Idade mínima: ${step.name || levelWord}`}
                                className={AGE_INPUT_CLASS}
                              />
                              <span>a</span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={120}
                                value={step.maxAge ?? ""}
                                onChange={(e) =>
                                  updateStep(index, {
                                    maxAge: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                                  })
                                }
                                placeholder="até"
                                aria-label={`Idade máxima: ${step.name || levelWord}`}
                                className={AGE_INPUT_CLASS}
                              />
                              <span>anos</span>
                              <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
                                · vazio = sem limite
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {isEdit ? (
            <SwitchField<ModalityFormValues>
              name="active"
              label="Ativa"
              hint="Quando inativa, deixa de aparecer em novas turmas e no cadastro da equipe."
              disabled={pending}
            />
          ) : null}
        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar"
                : "Adicionar"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
