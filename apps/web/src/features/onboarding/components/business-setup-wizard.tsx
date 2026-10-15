"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Lightbulb,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InitialsAvatar } from "@/components/shared/list";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { settingsService } from "@/services/settingsService";
import { categoriesService } from "@/services/categoriesService";
import { useOrganization } from "@/features/settings";
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
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

/** As 10 areas do passo 2; "Outra área" vem separada, em largura total. */
const STANDARD_PRESETS = getAllSegmentPresets().filter((p) => p.id !== "custom");

const CustomAreaIcon = SEGMENT_ICONS.custom;

/** Sugestoes clicaveis do nome da area em "Outra área". */
const CUSTOM_AREA_SUGGESTIONS = ["Teatro", "Xadrez", "Fotografia", "Autoescola"];

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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [businessName, setBusinessName] = useState(
    organization?.name === "Academia X" ? "" : organization?.name ?? "",
  );
  const [unitCity, setUnitCity] = useState("");
  const [showUnitField, setShowUnitField] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<ClassesBusinessSegment | null>(null);
  const [customSegmentName, setCustomSegmentName] = useState("");
  const [customProgression, setCustomProgression] = useState<CustomSegmentProgression>(
    DEFAULT_CUSTOM_PROGRESSION,
  );
  const [customBilling, setCustomBilling] = useState<ClassBillingMode>(DEFAULT_CUSTOM_BILLING);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [customAddedModalities, setCustomAddedModalities] = useState<string[]>([]);
  const [newModalityInput, setNewModalityInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Foco so com teclado fisico: no celular, o teclado cobriria a orientacao.
  useEffect(() => {
    if (step === 1 && !isTouchDevice()) nameInputRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (showUnitField && !isTouchDevice()) unitInputRef.current?.focus();
  }, [showUnitField]);
  useEffect(() => {
    if (selectedSegment === "custom" && !isTouchDevice()) customInputRef.current?.focus();
  }, [selectedSegment]);

  const isCustom = selectedSegment === "custom";
  // Preset efetivo: na "Outra área", trilha, palavras e cobranca seguem a escolha do dono.
  const activePreset: BusinessSegmentPreset = getSegmentPreset(
    selectedSegment ?? DEFAULT_CLASS_SEGMENT,
    customProgression,
    customBilling,
  );
  const previewName = businessName.trim() || "Seu espaço";
  const canLeaveStep2 = selectedSegment !== null && (!isCustom || Boolean(customSegmentName.trim()));
  const areaLabel = isCustom ? customSegmentName.trim() || activePreset.label : activePreset.label;

  const handleSelectSegment = (segId: ClassesBusinessSegment) => {
    if (segId === selectedSegment) return;
    setSelectedSegment(segId);
    setCustomAddedModalities([]);
    // O nome da "Outra área" nao vira modalidade: as aulas sao escolhidas no passo 3.
    setSelectedModalities(getSegmentPreset(segId).defaultModalities.slice(0, 2));
  };

  const handleToggleModality = (modality: string) => {
    if (selectedModalities.includes(modality)) {
      setSelectedModalities((prev) => prev.filter((m) => m !== modality));
    } else {
      setSelectedModalities((prev) => [...prev, modality]);
    }
  };

  const handleAddCustomModality = () => {
    const trimmed = newModalityInput.trim();
    if (!trimmed) return;
    if (!customAddedModalities.includes(trimmed) && !activePreset.defaultModalities.includes(trimmed)) {
      setCustomAddedModalities((prev) => [...prev, trimmed]);
    }
    if (!selectedModalities.includes(trimmed)) {
      setSelectedModalities((prev) => [...prev, trimmed]);
    }
    setNewModalityInput("");
  };

  const handleRemoveCustomModality = (modality: string) => {
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
      await settingsService.updateOrganization({
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
          // Modalidades criadas aqui vem com a trilha padrao: pede revisao.
          modalitiesReviewed: selectedModalities.length > 0 ? false : undefined,
        },
      });

      // 2. Atualiza dados da unidade com os dados do setup
      await settingsService.updateUnit({
        name: unitCity.trim(),
        address: undefined,
        phone: undefined,
      });

      // 3. Cria so as modalidades marcadas, com a trilha padrao da area. Sem
      // nenhuma marcada, nao inventa modalidade: o dono cadastra depois.
      for (const modName of selectedModalities) {
        try {
          await categoriesService.create({
            name: modName,
            progressionTrack: segmentTrackForModality(activePreset, modName),
          });
        } catch {
          // Ignora se já existir
        }
      }

      // 4. Garante que as boas-vindas apareçam no Dashboard e invalida queries
      updateOnboardingState({ seen: false });
      await qc.invalidateQueries({ queryKey: queryKeys.organization.detail });
      await qc.invalidateQueries({ queryKey: queryKeys.unit.detail });
      await qc.invalidateQueries({ queryKey: queryKeys.categories.all });

      // 5. Redireciona para o dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Erro ao concluir setup:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background flex flex-col justify-between pt-6 sm:pt-8 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-clip">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/3 blur-3xl" />

      {/* Top Header com margem superior confortável */}
      <header className="mx-auto w-full max-w-4xl flex items-center pb-5 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Image
            src={logoLightImage}
            alt="GestaraHub"
            className="h-8 sm:h-9 w-auto dark:hidden"
            priority
          />
          <Image
            src={logoDarkImage}
            alt="GestaraHub"
            className="hidden h-8 sm:h-9 w-auto dark:block"
            priority
          />
        </div>

      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-4xl flex-1 flex flex-col justify-center py-6 sm:py-8">
        {/* Passos logo acima do formulario: circulos ligados por linha, largura do form. */}
        <SetupStepper
          step={step}
          onGoTo={(target) => {
            if (target === 1 && step > 1) setStep(1);
            if (target === 2 && step > 2 && businessName.trim()) setStep(2);
          }}
        />
        {/* STEP 1: IDENTIFICAÇÃO DO ESPAÇO */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-lg space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Como se chama o seu espaço?
              </h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                É o nome que você e seus alunos vão ver.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm space-y-5">
              <div className="space-y-2">
                <Label htmlFor="business-name" className="inline-block text-sm font-semibold text-foreground">
                  Nome<span className="text-primary ml-0.5">*</span>
                </Label>
                <Input
                  ref={nameInputRef}
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && businessName.trim()) {
                      e.preventDefault();
                      setStep(2);
                    }
                  }}
                  placeholder="Nome da escola, estúdio ou o seu"
                  aria-describedby="business-name-hint"
                  className="h-12 text-base bg-background"
                />
                <p
                  id="business-name-hint"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Lightbulb className="size-3.5 shrink-0 text-amber-500" />
                  <span>Dá aula sozinho? Pode usar o seu nome.</span>
                </p>
              </div>

              {/* Previa ao vivo: o mesmo nome que aparece no topo do painel. */}
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
                <InitialsAvatar name={previewName} />
                <p className="min-w-0 text-sm text-muted-foreground break-words">
                  Assim aparece no topo:{" "}
                  <span className="font-semibold text-foreground">{previewName}</span>
                </p>
              </div>

              {showUnitField ? (
                <div className="space-y-2 animate-in fade-in-50 duration-200">
                  <Label htmlFor="unit-city" className="text-xs font-medium text-muted-foreground">
                    Unidade ou filial (opcional)
                  </Label>
                  <Input
                    ref={unitInputRef}
                    id="unit-city"
                    value={unitCity}
                    onChange={(e) => setUnitCity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && businessName.trim()) {
                        e.preventDefault();
                        setStep(2);
                      }
                    }}
                    placeholder="Nome da unidade"
                    className="h-12 text-base bg-background"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUnitField(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Tenho mais de um endereço</span>
                </button>
              )}

              <div className="pt-1">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!businessName.trim()}
                  className="w-full h-11 font-semibold gap-2 shadow-sm transition-all"
                >
                  <span>Continuar</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ÁREA DO ESPAÇO */}
        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                O que você ensina?
              </h1>
              <p className="text-muted-foreground text-sm">
                Ajustamos turmas, evolução e textos para a sua área.
              </p>
            </div>

            {/* 10 areas em cards compactos: icone, nome e uma linha de exemplos. */}
            <div
              role="radiogroup"
              aria-label="Área do espaço"
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3"
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
                    onClick={() => handleSelectSegment(preset.id)}
                    className={cn(
                      "group relative flex flex-col gap-2 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          "size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="size-4 sm:size-4.5" />
                      </div>
                      {isSelected && (
                        <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-sm font-bold text-foreground leading-snug">
                        {preset.label}
                      </span>
                      <span className="block text-xs text-muted-foreground leading-snug">
                        {preset.examples}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* "Outra área", tracejada, em 2 colunas: largura total no celular e, a
                  partir de sm, fecha a ultima linha (10 areas em 3 colunas sobram 2 vagas). */}
              <button
                type="button"
                role="radio"
                aria-checked={isCustom}
                onClick={() => handleSelectSegment("custom")}
                className={cn(
                  "col-span-2 flex items-center justify-between gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCustom
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                    : "border-dashed border-border/90 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      isCustom ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    <CustomAreaIcon className="size-4 sm:size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-foreground leading-snug">Outra área</span>
                    <span className="block text-xs text-muted-foreground leading-snug">
                      Escolha se não achou a sua
                    </span>
                  </div>
                </div>
                {isCustom && (
                  <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="size-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>

            {/* Confirmacao da area escolhida: o que muda, sem tour. */}
            {selectedSegment && !isCustom && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-300 animate-in fade-in-50 duration-200"
              >
                <CircleCheck className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span>{progressionConfirmation(activePreset)}</span>
              </p>
            )}

            {/* "Outra área": nome da area, como os alunos avancam e como cobra. */}
            {isCustom && (
              <div className="p-4 sm:p-5 rounded-2xl border border-primary/25 bg-card space-y-4 animate-in fade-in-50 duration-200">
                <div className="space-y-2">
                  <Label
                    htmlFor="custom-segment-input"
                    className="inline-block text-sm font-semibold text-foreground"
                  >
                    O que você ensina?<span className="text-primary ml-0.5">*</span>
                  </Label>
                  <Input
                    ref={customInputRef}
                    id="custom-segment-input"
                    value={customSegmentName}
                    onChange={(e) => setCustomSegmentName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customSegmentName.trim()) {
                        e.preventDefault();
                        setStep(3);
                      }
                    }}
                    placeholder="Nome da sua área ou atividade"
                    className="h-11 bg-background"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_AREA_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setCustomSegmentName(suggestion)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                          customSegmentName.trim() === suggestion
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        <Plus className="size-3" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p id="custom-progression-label" className="text-sm font-semibold text-foreground">
                    Como seus alunos avançam?
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="custom-progression-label"
                    className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
                  >
                    {CUSTOM_PROGRESSION_OPTIONS.map((option) => {
                      const selected = customProgression === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCustomProgression(option.value)}
                          className={cn(
                            "rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer select-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                              : "text-muted-foreground hover:bg-background/50",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Na dúvida, escolha “Não avançam”. Dá para mudar depois.
                  </p>
                </div>

                <div className="space-y-2">
                  <p id="custom-billing-label" className="text-sm font-semibold text-foreground">
                    Como você cobra?
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="custom-billing-label"
                    className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1"
                  >
                    {CUSTOM_BILLING_OPTIONS.map((option) => {
                      const selected = customBilling === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCustomBilling(option.value)}
                          className={cn(
                            "rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer select-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                              : "text-muted-foreground hover:bg-background/50",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    É só o padrão: cada turma pode cobrar diferente.
                  </p>
                </div>
              </div>
            )}

            {/* Ações Step 2 */}
            <div className="pt-1 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-11 px-5 gap-2"
              >
                <ArrowLeft className="size-4" />
                <span>Voltar</span>
              </Button>

              <Button
                onClick={() => setStep(3)}
                disabled={!canLeaveStep2}
                className="h-11 px-6 font-semibold gap-2 shadow-sm"
              >
                <span>Continuar</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PRÉ-CRIAÇÃO DE MODALIDADES (Sem redundâncias) */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-xl space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Quais aulas você oferece?
              </h1>
              <p className="text-muted-foreground text-sm">
                Selecione as modalidades para criar suas primeiras turmas.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6">
              {/* Header das modalidades com contagem */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground">
                    Aulas de {areaLabel}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Clique nas pílulas para ativar ou desativar o que você ensina:
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                  {selectedModalities.length} {selectedModalities.length === 1 ? "selecionada" : "selecionadas"}
                </span>
              </div>

              {/* Lista Unificada de Pílulas Interativas */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {allAvailableModalities.map((mod) => {
                    const isMarked = selectedModalities.includes(mod);
                    const isCustomAdded = customAddedModalities.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => handleToggleModality(mod)}
                        className={cn(
                          "group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer",
                          isMarked
                            ? "border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                            : "border-border/80 bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "size-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold",
                            isMarked
                              ? "bg-primary-foreground text-primary"
                              : "border border-muted-foreground/40 text-muted-foreground",
                          )}
                        >
                          {isMarked ? "✓" : "+"}
                        </span>
                        <span>{mod}</span>
                        {isCustomAdded && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomModality(mod);
                            }}
                            className="opacity-70 hover:opacity-100 hover:text-destructive ml-0.5"
                            title="Remover"
                          >
                            <X className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedModalities.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pt-1">
                    Nenhuma modalidade selecionada. Você poderá cadastrar turmas depois no painel.
                  </p>
                )}
              </div>

              {/* Adicionar outra modalidade com placeholder contextual */}
              <div className="space-y-2 pt-3 border-t border-border/40">
                <Label
                  htmlFor="add-modality"
                  className="text-xs font-semibold text-muted-foreground"
                >
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
                    className="h-10 bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCustomModality}
                    disabled={!newModalityInput.trim()}
                    className="h-10 px-4 gap-1.5 shrink-0"
                  >
                    <Plus className="size-4" />
                    <span>Adicionar</span>
                  </Button>
                </div>
              </div>

              {/* Ações Finais */}
              <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="h-11 px-5 gap-2"
                >
                  <ArrowLeft className="size-4" />
                  <span>Voltar</span>
                </Button>

                <Button
                  onClick={handleFinishSetup}
                  disabled={isSubmitting}
                  className="h-11 px-7 font-semibold gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Configurando...</span>
                    </>
                  ) : (
                    <>
                      <span>Concluir e Começar</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-4xl pt-5 border-t border-border/40 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>Configuração inicial • GestaraHub Sistema Gratuito</p>
        <p>Você poderá alterar essas informações em Configurações.</p>
      </footer>
    </div>
  );
}

const SETUP_STEPS = ["Espaço", "Área", "Modalidades"] as const;

/**
 * Indicador dos 3 passos: numero em circulo + nome, ligados por uma linha.
 * Atual em destaque, concluido com check (clicavel para voltar), proximo em
 * cinza. Mesma largura do formulario do passo 1.
 */
function SetupStepper({ step, onGoTo }: { step: number; onGoTo: (step: number) => void }) {
  return (
    <nav aria-label="Progresso do cadastro" className="mx-auto mb-8 w-full max-w-lg sm:mb-10">
      <ol className="flex items-center">
        {SETUP_STEPS.map((label, index) => {
          const number = index + 1;
          const done = number < step;
          const current = number === step;
          const content = (
            <>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  current && "bg-primary text-primary-foreground shadow-xs",
                  done && "bg-primary/10 text-primary",
                  !current && !done && "border border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : number}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  // Celular estreito: so o nome do passo atual (os outros ficam no numero).
                  !current && "hidden min-[400px]:inline",
                  current ? "font-semibold text-foreground" : done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} className={cn("flex items-center", index < SETUP_STEPS.length - 1 && "flex-1")}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onGoTo(number)}
                  className="flex items-center gap-2 rounded-full pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Voltar para ${label}`}
                >
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                  {content}
                </span>
              )}
              {index < SETUP_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("mx-3 h-px flex-1 sm:mx-4", done ? "bg-primary/40" : "bg-border")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
