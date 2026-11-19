"use client";

import { RequiredMark } from "@/components/form";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  Lightbulb,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InitialsAvatar } from "@/components/shared/list";
import { useRouteLoadingBar } from "@/components/layout/navigation-progress";
import { cn } from "@/lib/utils";
import { normalizeText } from "@/lib/text";
import { startNavigationProgress } from "@/lib/unsaved-changes";
import { queryKeys } from "@/lib/queryKeys";
import { settingsService } from "@/services/settings/settingsService";
import { onboardingService } from "@/services/settings/onboardingService";
import { categoriesService } from "@/services/catalog/categoriesService";
import { persistSetupToBackendAction } from "@/app/(auth)/signup-actions";
import { useOrganization } from "@/features/settings";
import { deviceBrazilTimeZone } from "@gestarahub/core/date";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import {
  CUSTOM_BILLING_OPTIONS,
  CUSTOM_PROGRESSION_OPTIONS,
  DEFAULT_CLASS_SEGMENT,
  DEFAULT_CUSTOM_BILLING,
  DEFAULT_CUSTOM_PROGRESSION,
  getAllSegmentPresets,
  getSegmentPreset,
  segmentProgressionSummary,
  segmentTrackForModality,
  type BusinessSegmentPreset,
} from "@/lib/business-segment-presets";
import { SEGMENT_ICONS } from "@/lib/business-segment-icons";
import type {
  ClassBillingMode,
  ClassesBusinessSegment,
  CustomSegmentProgression,
} from "@gestarahub/contracts";
import logoLightImage from "@/assets/logo-light.svg";
import logoDarkImage from "@/assets/logo-dark.svg";

/** As 10 areas do passo 2; "Outra área" fecha a lista. */
const STANDARD_PRESETS = getAllSegmentPresets().filter((p) => p.id !== "custom");

const CustomAreaIcon = SEGMENT_ICONS.custom;

/** Sugestoes clicaveis do nome da area em "Outra área". */
const CUSTOM_AREA_SUGGESTIONS = ["Teatro", "Xadrez", "Fotografia", "Autoescola"];

/** Nome do espaco e da unidade: ate 80 caracteres (cabe no topo e no cookie). */
export const MAX_SPACE_NAME = 80;

/** Mesma aula com outra caixa ou acento ("Judo" e "Judô") e a mesma aula. */
const sameName = (a: string, b: string) => normalizeText(a) === normalizeText(b);

/**
 * "Outra área" com o nome de uma area da lista ("Lutas", "Pilates", "Judô"):
 * a area pronta tem trilha e textos (ONB-31). Compara o nome e os exemplos.
 */
function matchingPreset(name: string): BusinessSegmentPreset | undefined {
  const target = normalizeText(name);
  if (target.length < 3) return undefined;
  return STANDARD_PRESETS.find((preset) =>
    [preset.label, ...preset.label.split(/\s+e\s+/), ...preset.examples.split(/,\s*/)].some(
      (word) => normalizeText(word) === target,
    ),
  );
}

/**
 * Rascunho do assistente na aba (sessionStorage): recarregar no meio nao perde
 * o que foi escolhido. O passo fica na URL (?passo=2), e o Voltar do
 * navegador volta um passo.
 */
const DRAFT_KEY = "gestarahub:setup-draft";

interface SetupDraft {
  businessName: string;
  unitCity: string;
  showUnitField: boolean;
  selectedSegment: ClassesBusinessSegment | null;
  customSegmentName: string;
  customProgression: CustomSegmentProgression;
  customBilling: ClassBillingMode;
  selectedModalities: string[];
  customAddedModalities: string[];
  modalitiesTouched: boolean;
}

function readDraft(): Partial<SetupDraft> {
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<SetupDraft>;
  } catch {
    return {};
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sem armazenamento: nada a limpar.
  }
}

/** Celular/tablet: nao abre o teclado sozinho (doc 07, 3.2). */
function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/** Linha de confirmacao do passo 2: como os alunos avancam na area escolhida. */
function progressionConfirmation(preset: BusinessSegmentPreset): string {
  const summary = segmentProgressionSummary(preset);
  return summary
    ? `Seus alunos avançam por ${summary}. Dá para trocar depois.`
    : "Sem etapas de evolução por enquanto. Dá para ligar depois.";
}

export function BusinessSetupWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: organization } = useOrganization();
  const [, updateOnboardingState] = useOnboardingState();

  const searchParams = useSearchParams();
  // O assistente so monta no navegador (SetupRouteGuard): o rascunho le direto.
  const [draft] = useState(readDraft);
  const [businessName, setBusinessName] = useState(
    draft.businessName ?? (organization?.name === "Academia X" ? "" : organization?.name ?? ""),
  );
  const [unitCity, setUnitCity] = useState(draft.unitCity ?? "");
  const [showUnitField, setShowUnitField] = useState(draft.showUnitField ?? false);
  const [selectedSegment, setSelectedSegment] = useState<ClassesBusinessSegment | null>(
    draft.selectedSegment ?? null,
  );
  const [customSegmentName, setCustomSegmentName] = useState(draft.customSegmentName ?? "");
  const [customProgression, setCustomProgression] = useState<CustomSegmentProgression>(
    draft.customProgression ?? DEFAULT_CUSTOM_PROGRESSION,
  );
  const [customBilling, setCustomBilling] = useState<ClassBillingMode>(
    draft.customBilling ?? DEFAULT_CUSTOM_BILLING,
  );
  const [selectedModalities, setSelectedModalities] = useState<string[]>(draft.selectedModalities ?? []);
  const [customAddedModalities, setCustomAddedModalities] = useState<string[]>(
    draft.customAddedModalities ?? [],
  );
  // O aviso de "nenhuma aula" so depois de mexer nas aulas.
  const [modalitiesTouched, setModalitiesTouched] = useState(draft.modalitiesTouched ?? false);
  const [newModalityInput, setNewModalityInput] = useState("");

  // Passo da URL, sem pular o que falta: sem nome fica no 1; sem area, no 2.
  const areaReady =
    selectedSegment !== null && (selectedSegment !== "custom" || customSegmentName.trim() !== "");
  const maxStep = !businessName.trim() ? 1 : areaReady ? 3 : 2;
  const requestedStep = Number(searchParams.get("passo")) || 1;
  const step = Math.min(Math.max(requestedStep, 1), maxStep) as 1 | 2 | 3;
  const goTo = (next: 1 | 2 | 3, replace = false) => {
    const url = `/setup?passo=${next}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  useEffect(() => {
    const value: SetupDraft = {
      businessName,
      unitCity,
      showUnitField,
      selectedSegment,
      customSegmentName,
      customProgression,
      customBilling,
      selectedModalities,
      customAddedModalities,
      modalitiesTouched,
    };
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value));
    } catch {
      // Sem armazenamento: segue sem rascunho.
    }
  }, [
    businessName,
    unitCity,
    showUnitField,
    selectedSegment,
    customSegmentName,
    customProgression,
    customBilling,
    selectedModalities,
    customAddedModalities,
    modalitiesTouched,
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useRouteLoadingBar(isSubmitting);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const customFormRef = useRef<HTMLFormElement>(null);
  // Troca de passo leva o foco ao titulo novo (o foco se perdia). ONB-22.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Setas e Home/End andam pela lista de areas (Enter ou espaco escolhe).
  const moveAreaFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown" || event.key === "ArrowRight"
            ? Math.min(items.length - 1, index + 1)
            : Math.max(0, index - 1);
    event.preventDefault();
    items[next]?.focus();
  };

  // Foco so com teclado fisico: no celular, o teclado cobriria a orientacao.
  useEffect(() => {
    if (step === 1 && !isTouchDevice()) nameInputRef.current?.focus();
  }, [step]);
  // Cada passo comeca do topo (a lista de areas e longa e a pagina pode estar rolada).
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (showUnitField && !isTouchDevice()) unitInputRef.current?.focus();
  }, [showUnitField]);
  useEffect(() => {
    if (selectedSegment !== "custom" || step !== 2) return;
    // A lista de areas e longa: leva os campos da "Outra área" para a tela.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    customFormRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    if (!isTouchDevice()) customInputRef.current?.focus({ preventScroll: true });
  }, [selectedSegment, step]);

  const isCustom = selectedSegment === "custom";
  // Preset efetivo: na "Outra área", trilha, palavras e cobranca seguem a escolha do dono.
  const activePreset: BusinessSegmentPreset = getSegmentPreset(
    selectedSegment ?? DEFAULT_CLASS_SEGMENT,
    customProgression,
    customBilling,
  );
  const previewName = businessName.trim() || "Seu espaço";
  const areaLabel = isCustom ? customSegmentName.trim() || activePreset.label : activePreset.label;
  const suggestedPreset = isCustom ? matchingPreset(customSegmentName) : undefined;

  const handleSelectSegment = (segId: ClassesBusinessSegment) => {
    if (segId === selectedSegment) return;
    setSelectedSegment(segId);
    setCustomAddedModalities([]);
    // O nome da "Outra área" nao vira modalidade: as aulas sao escolhidas no passo 3.
    setSelectedModalities(getSegmentPreset(segId).defaultModalities.slice(0, 2));
  };

  const handleToggleModality = (modality: string) => {
    setModalitiesTouched(true);
    if (selectedModalities.includes(modality)) {
      setSelectedModalities((prev) => prev.filter((m) => m !== modality));
    } else {
      setSelectedModalities((prev) => [...prev, modality]);
    }
  };

  const handleAddCustomModality = () => {
    const trimmed = newModalityInput.trim();
    if (!trimmed) return;
    setModalitiesTouched(true);
    // "judo" com "Judô" na lista marca a que ja existe, sem outro chip.
    const existing = [...activePreset.defaultModalities, ...customAddedModalities].find((m) => sameName(m, trimmed));
    const name = existing ?? trimmed;
    if (!existing) setCustomAddedModalities((prev) => [...prev, trimmed]);
    if (!selectedModalities.includes(name)) setSelectedModalities((prev) => [...prev, name]);
    setNewModalityInput("");
  };

  const handleRemoveCustomModality = (modality: string) => {
    setModalitiesTouched(true);
    setCustomAddedModalities((prev) => prev.filter((m) => m !== modality));
    setSelectedModalities((prev) => prev.filter((m) => m !== modality));
  };

  const allAvailableModalities = Array.from(
    new Set([...activePreset.defaultModalities, ...customAddedModalities]),
  );

  const handleFinishSetup = async () => {
    if (!selectedSegment) return;
    setIsSubmitting(true);
    try {
      const finalName = businessName.trim() || organization?.name || "Meu espaço";

      // 1. Atualiza dados da organização
      const updatedOrganization = await settingsService.updateOrganization({
        name: finalName,
        segment: areaLabel,
        model: "classes",
        classSegment: selectedSegment,
        customSegmentName: isCustom ? customSegmentName.trim() : undefined,
        customSegmentProgression: isCustom ? customProgression : undefined,
        customSegmentBilling: isCustom ? customBilling : undefined,
        settings: {
          ...organization?.settings,
          onboardingCompleted: true,
          // Fuso de quem cria a conta (aparelho), se ainda nao escolhido: sem
          // endereco, o espaco nascia em Brasilia (19/11/2026).
          timeZone: organization?.settings?.timeZone ?? deviceBrazilTimeZone(),
          // Modalidades criadas aqui vem com a trilha padrao: pede revisao.
          // Area sem trilha (pilates, funcional...) nao tem niveis nem metas a revisar (ONB-18).
          modalitiesReviewed:
            selectedModalities.length > 0 && activePreset.progressionTemplate !== null ? false : undefined,
        },
      });

      // 2. Atualiza dados da unidade com os dados do setup
      const updatedUnit = await settingsService.updateUnit({
        name: unitCity.trim(),
        address: undefined,
        phone: undefined,
      });

      // 3. Cria so as modalidades marcadas, com a trilha padrao da area. Sem
      // nenhuma marcada, nao inventa modalidade: o dono cadastra depois.
      // Repetidas por caixa ou acento viram uma so.
      const unique = selectedModalities.filter(
        (name, index, list) => list.findIndex((other) => sameName(other, name)) === index,
      );
      const failed: string[] = [];
      for (const modName of unique) {
        try {
          await categoriesService.create({
            name: modName,
            progressionTrack: segmentTrackForModality(activePreset, modName),
          });
        } catch {
          failed.push(modName);
        }
      }
      if (failed.length > 0) {
        toast.error(`Não deu para criar: ${failed.join(", ")}. Cadastre em Modalidades.`);
      }

      // 3.1 Sincroniza as escolhas do setup no Postgres (Supabase) quando for conta real
      const allCategories = await categoriesService.list();
      await persistSetupToBackendAction({
        organization: updatedOrganization,
        unit: updatedUnit,
        categories: allCategories,
      });

      // 4. Garante que as boas-vindas apareçam no Dashboard e aquece os dados em paralelo
      updateOnboardingState({ seen: false });
      clearDraft();
      startNavigationProgress({ immediate: true });
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.categories.all }),
        qc.fetchQuery({
          queryKey: queryKeys.unit.detail,
          queryFn: () => settingsService.getUnit(),
          staleTime: 0,
        }),
        qc.fetchQuery({
          queryKey: queryKeys.onboarding.snapshot,
          queryFn: () => onboardingService.getOnboardingSnapshot(),
          staleTime: 0,
        }),
      ]);
      await qc.invalidateQueries({ queryKey: queryKeys.organization.detail });

      // 5. Redireciona para o dashboard
      router.push("/dashboard");
    } catch {
      setError("Não foi possível concluir. Tente de novo.");
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step > 1) goTo((step - 1) as 1 | 2 | 3, true);
  };

  // Passo 1: nome obrigatorio (Enter no nome ou na unidade tambem avanca).
  const submitStepOne = () => {
    if (!businessName.trim()) {
      setError("Informe o nome do espaço.");
      nameInputRef.current?.focus();
      return;
    }
    setError(null);
    goTo(2);
  };

  // Passo 2: area padrao avanca no clique; "Outra área" abre os campos e usa o botao.
  const handlePickArea = (segId: ClassesBusinessSegment) => {
    setError(null);
    handleSelectSegment(segId);
    if (segId !== "custom") goTo(3);
  };

  const submitCustomArea = () => {
    const name = customSegmentName.trim();
    if (!name) {
      setError("Informe o que você ensina.");
      customInputRef.current?.focus();
      return;
    }
    setError(null);
    // O nome da area ja e a 1a aula sugerida (marcada); da para desmarcar.
    if (!modalitiesTouched && selectedModalities.length === 0) {
      setCustomAddedModalities([name]);
      setSelectedModalities([name]);
    }
    goTo(3);
  };

  const copy = STEP_COPY[step];

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Progresso: barra fina no topo */}
      <div
        role="progressbar"
        aria-label="Progresso da configuração inicial"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        className="h-1 w-full bg-muted"
      >
        <div className="h-1 bg-primary transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <header className="mx-auto w-full max-w-xl px-4 pt-6 sm:pt-8">
        <Image src={logoLightImage} alt="GestaraHub" className="h-9 sm:h-10 w-auto dark:hidden" priority />
        <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-9 sm:h-10 w-auto dark:block" priority />
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between text-sm text-muted-foreground">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </button>
          ) : (
            <span />
          )}
          <span>{step} de 3</span>
        </div>

        <div key={step} className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-extrabold tracking-tight text-foreground outline-none sm:text-4xl"
          >
            {copy.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>

          {/* PASSO 1: NOME DO ESPACO */}
          {step === 1 && (
            <form
              className="mt-8 space-y-6"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submitStepOne();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="business-name" className="inline-block text-base font-semibold text-foreground">
                  <span>
                    Nome
                    <RequiredMark />
                  </span>
                </Label>
                <Input
                  ref={nameInputRef}
                  id="business-name"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Nome da escola, estúdio ou o seu"
                  maxLength={MAX_SPACE_NAME}
                  aria-describedby={error ? "business-name-error" : "business-name-hint"}
                  aria-invalid={error ? true : undefined}
                  className="bg-background"
                />
                {/* Erro no lugar da dica, logo abaixo do campo (padrao do FieldShell). */}
                {error ? (
                  <p id="business-name-error" role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : (
                  <p id="business-name-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb className="size-3.5 shrink-0 text-amber-500" />
                    <span>Dá aula sozinho? Pode usar o seu nome.</span>
                  </p>
                )}
              </div>

              {/* Previa ao vivo: o mesmo nome que aparece no topo do painel. */}
              <div className="flex items-center gap-3">
                <InitialsAvatar name={previewName} />
                <p className="min-w-0 text-sm text-muted-foreground break-words">
                  Assim aparece no topo: <span className="font-semibold text-foreground">{previewName}</span>
                </p>
              </div>

              {showUnitField ? (
                <div className="space-y-2 animate-in fade-in-50 duration-200">
                  <Label htmlFor="unit-city" className="text-sm font-medium text-foreground">
                    Unidade ou filial (opcional)
                  </Label>
                  <Input
                    ref={unitInputRef}
                    id="unit-city"
                    value={unitCity}
                    onChange={(e) => setUnitCity(e.target.value)}
                    placeholder="Nome da unidade"
                    maxLength={MAX_SPACE_NAME}
                    className="bg-background"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUnitField(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Tenho mais de um endereço</span>
                </button>
              )}

              <div className="flex items-center gap-4 pt-2">
                <Button type="submit" className="gap-1.5 font-semibold text-xs shadow-xs">
                  Continuar
                  <ArrowRight className="size-3.5" />
                </Button>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                  ou pressione Enter <CornerDownLeft className="size-3" />
                </span>
              </div>
            </form>
          )}

          {/* PASSO 2: AREA (uma lista; a area padrao avanca no clique) */}
          {step === 2 && (
            <div className="mt-8 space-y-5">
              <div
                role="radiogroup"
                aria-label="Área do espaço"
                onKeyDown={moveAreaFocus}
                className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
              >
                {STANDARD_PRESETS.map((preset) => {
                  const Icon = SEGMENT_ICONS[preset.id];
                  const isSelected = selectedSegment === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handlePickArea(preset.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                        "focus-visible:outline-none focus-visible:bg-muted/60",
                        isSelected ? "bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{preset.label}</span>
                      {isSelected ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : (
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" />
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isCustom}
                  onClick={() => handlePickArea("custom")}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:bg-muted/60",
                    isCustom ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <CustomAreaIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">Outra área</span>
                  {isCustom ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </button>
              </div>

              {/* "Outra área": nome da area, como os alunos avancam e como cobra. */}
              {isCustom && (
                <form
                  ref={customFormRef}
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitCustomArea();
                  }}
                  className="space-y-5 animate-in fade-in-50 duration-200"
                >
                  <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-2">
                      <Label htmlFor="custom-segment-input" className="inline-block text-sm font-semibold text-foreground">
                        <span>
                          O que você ensina?
                          <RequiredMark />
                        </span>
                      </Label>
                      <Input
                        ref={customInputRef}
                        id="custom-segment-input"
                        value={customSegmentName}
                        onChange={(e) => {
                          setCustomSegmentName(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Nome da sua área ou atividade"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "custom-segment-error" : undefined}
                        className="bg-background"
                      />
                      {error ? (
                        <p id="custom-segment-error" role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      ) : null}
                      {suggestedPreset ? (
                        <p className="text-sm text-muted-foreground">
                          Já existe a área {suggestedPreset.label}, com a evolução pronta.{" "}
                          <button
                            type="button"
                            onClick={() => handlePickArea(suggestedPreset.id)}
                            className="cursor-pointer font-medium text-foreground underline underline-offset-4 hover:text-primary"
                          >
                            Usar {suggestedPreset.label}
                          </button>
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {CUSTOM_AREA_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setCustomSegmentName(suggestion);
                              setError(null);
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                              customSegmentName.trim() === suggestion
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ChoiceGroup
                      id="custom-progression"
                      label="Como seus alunos avançam?"
                      hint="Na dúvida, escolha “Não avançam”. Dá para mudar depois."
                      options={CUSTOM_PROGRESSION_OPTIONS}
                      value={customProgression}
                      onChange={setCustomProgression}
                    />
                    <ChoiceGroup
                      id="custom-billing"
                      label="Como você cobra?"
                      hint="É só o padrão: cada turma pode cobrar diferente."
                      options={CUSTOM_BILLING_OPTIONS}
                      value={customBilling}
                      onChange={setCustomBilling}
                    />
                  </div>

                  <Button type="submit" className="gap-1.5 font-semibold text-xs shadow-xs">
                    Continuar
                    <ArrowRight className="size-3.5" />
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* PASSO 3: AULAS (modalidades criadas com a trilha da area) */}
          {step === 3 && (
            <div className="mt-8 space-y-6">
              {/* A area escolhida e como os alunos avancam (confirmacao, sem tour). */}
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Aulas de {areaLabel}</span>
                {" · "}
                <span role="status">{progressionConfirmation(activePreset)}</span>
              </p>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {allAvailableModalities.map((mod) => {
                    const isMarked = selectedModalities.includes(mod);
                    const isCustomAdded = customAddedModalities.includes(mod);
                    // Chip com alvo de toque de 32px; remover e um botao irmao
                    // (antes um span role=button dentro do botao).
                    return (
                      <span
                        key={mod}
                        className={cn(
                          "inline-flex max-w-full items-center rounded-full border transition-colors",
                          isMarked
                            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={isMarked}
                          onClick={() => handleToggleModality(mod)}
                          className="inline-flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-left text-sm font-medium"
                        >
                          <span aria-hidden className="w-3 shrink-0 text-center text-xs font-bold">
                            {isMarked ? "✓" : "+"}
                          </span>
                          <span className="min-w-0 break-words">{mod}</span>
                        </button>
                        {isCustomAdded && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomModality(mod)}
                            className="-ml-1.5 flex min-h-8 cursor-pointer items-center rounded-full pl-1 pr-2.5 opacity-70 hover:opacity-100"
                            aria-label={`Remover ${mod}`}
                            title={`Remover ${mod}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedModalities.length} {selectedModalities.length === 1 ? "selecionada" : "selecionadas"}
                </p>
                {selectedModalities.length === 0 && modalitiesTouched && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Nenhuma aula marcada. Dá para cadastrar depois.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-modality" className="text-sm font-medium text-foreground">
                  Não encontrou sua aula? Adicione abaixo:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="add-modality"
                    value={newModalityInput}
                    onChange={(e) => setNewModalityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomModality();
                      }
                    }}
                    placeholder="Informe o nome da aula"
                    className="bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCustomModality}
                    disabled={!newModalityInput.trim()}
                    className="px-4 gap-1.5 shrink-0"
                  >
                    <Plus className="size-4" />
                    <span>Adicionar</span>
                  </Button>
                </div>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                onClick={handleFinishSetup}
                disabled={isSubmitting}
                className="gap-1.5 font-semibold text-xs shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Configurando...</span>
                  </>
                ) : (
                  <>
                    <span>Concluir</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Tudo pode ser mudado depois em Configurações.</p>
      </main>
    </div>
  );
}

const STEP_COPY = {
  1: { title: "Como se chama o seu espaço?", subtitle: "É o nome que você e seus alunos vão ver." },
  2: { title: "O que você ensina?", subtitle: "Ajustamos turmas, evolução e textos para a sua área." },
  3: { title: "Quais aulas você oferece?", subtitle: "Marque as aulas que você dá. Dá para mudar depois." },
} as const;

/** Escolha unica em grade (2 colunas), com dica abaixo. */
function ChoiceGroup<T extends string>({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-semibold text-foreground">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-background font-medium text-foreground ring-1 ring-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
