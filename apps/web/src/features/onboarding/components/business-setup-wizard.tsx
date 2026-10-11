"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Dumbbell,
  Languages,
  Loader2,
  Plus,
  PlusCircle,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { settingsService } from "@/services/settingsService";
import { categoriesService } from "@/services/categoriesService";
import { useOrganization } from "@/features/settings";
import { useOnboardingState } from "../hooks/use-onboarding-state";
import {
  CLASSES_SEGMENT_PRESETS,
  segmentTrackForModality,
  type BusinessSegmentPreset,
} from "@/lib/business-segment-presets";
import type { ClassesBusinessSegment } from "@gestarahub/contracts";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

const SEGMENT_ICONS: Record<ClassesBusinessSegment, React.ComponentType<{ className?: string }>> = {
  martial_arts: Award,
  pilates_yoga: Activity,
  music_languages: Languages,
  dance: Sparkles,
  functional_training: Dumbbell,
  swimming_sports: Waves,
  custom: PlusCircle,
};

const STANDARD_SEGMENTS: ClassesBusinessSegment[] = [
  "martial_arts",
  "pilates_yoga",
  "music_languages",
  "dance",
  "functional_training",
  "swimming_sports",
];

function getModalityPlaceholder(segment: ClassesBusinessSegment): string {
  switch (segment) {
    case "martial_arts":
      return "Ex.: Karatê, Capoeira, Taekwondo, Boxe...";
    case "pilates_yoga":
      return "Ex.: Mat Pilates, Pilates Clínico, Ashtanga...";
    case "music_languages":
      return "Ex.: Bateria, Piano, Canto, Francês...";
    case "dance":
      return "Ex.: Dança Contemporânea, Sapateado, K-Pop...";
    case "functional_training":
      return "Ex.: Levantamento de Peso (LPO), Mobilidade...";
    case "swimming_sports":
      return "Ex.: Polo Aquático, Futevôlei, Vôlei de Praia...";
    default:
      return "Ex.: Nome da aula ou modalidade...";
  }
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
  const [selectedSegment, setSelectedSegment] = useState<ClassesBusinessSegment>("martial_arts");
  const [customSegmentName, setCustomSegmentName] = useState("");
  const [selectedModalities, setSelectedModalities] = useState<string[]>([
    "Jiu-Jitsu",
    "Muay Thai",
  ]);
  const [customAddedModalities, setCustomAddedModalities] = useState<string[]>([]);
  const [newModalityInput, setNewModalityInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePreset: BusinessSegmentPreset =
    CLASSES_SEGMENT_PRESETS[selectedSegment] ?? CLASSES_SEGMENT_PRESETS.martial_arts;

  const handleSelectSegment = (segId: ClassesBusinessSegment) => {
    setSelectedSegment(segId);
    setCustomAddedModalities([]);
    if (segId === "custom") {
      // O nome da area nao vira modalidade: as aulas sao escolhidas no passo 3.
      setSelectedModalities([]);
    } else {
      const preset = CLASSES_SEGMENT_PRESETS[segId];
      setSelectedModalities(preset.defaultModalities.slice(0, 2));
    }
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
    setIsSubmitting(true);
    try {
      const finalName = businessName.trim() || organization?.name || "Minha Academia";
      const finalSegmentLabel =
        selectedSegment === "custom"
          ? customSegmentName.trim() || "Personalizado"
          : activePreset.label;

      // 1. Atualiza dados da organização
      await settingsService.updateOrganization({
        name: finalName,
        segment: finalSegmentLabel,
        model: "classes",
        classSegment: selectedSegment,
        customSegmentName: selectedSegment === "custom" ? customSegmentName.trim() : undefined,
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
    <div className="relative min-h-screen w-full bg-background flex flex-col justify-between pt-6 sm:pt-8 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/3 blur-3xl" />

      {/* Top Header com margem superior confortável */}
      <header className="mx-auto w-full max-w-4xl flex items-center justify-between pb-5 border-b border-border/40">
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

        {/* Step Progress Tracker */}
        <nav aria-label="Progresso do cadastro" className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium">
          {/* Step 1 badge */}
          <div
            onClick={() => {
              if (step > 1) setStep(1);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-semibold",
              step === 1
                ? "bg-primary/10 text-primary border border-primary/25"
                : step > 1
                  ? "text-primary hover:bg-muted/40 cursor-pointer"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center font-bold text-[10px]",
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : step > 1
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step > 1 ? "✓" : "1"}
            </span>
            <span className="hidden sm:inline">Espaço</span>
          </div>

          <span className="text-border text-xs">→</span>

          {/* Step 2 badge */}
          <div
            onClick={() => {
              if (step > 2 && businessName.trim()) setStep(2);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-semibold",
              step === 2
                ? "bg-primary/10 text-primary border border-primary/25"
                : step > 2
                  ? "text-primary hover:bg-muted/40 cursor-pointer"
                  : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center font-bold text-[10px]",
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : step > 2
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step > 2 ? "✓" : "2"}
            </span>
            <span className="hidden sm:inline">Segmento</span>
          </div>

          <span className="text-border text-xs">→</span>

          {/* Step 3 badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-semibold",
              step === 3
                ? "bg-primary/10 text-primary border border-primary/25"
                : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center font-bold text-[10px]",
                step === 3
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              3
            </span>
            <span className="hidden sm:inline">Modalidades</span>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-4xl flex-1 flex flex-col justify-center py-6 sm:py-8">
        {/* STEP 1: IDENTIFICAÇÃO DO ESPAÇO */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-lg space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Como se chama o seu espaço?
              </h1>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Vamos personalizar o seu painel e as turmas com a sua marca.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-5">
              <div className="space-y-2">
                <Label htmlFor="business-name" className="inline-block text-sm font-semibold text-foreground">
                  Nome<span className="text-primary ml-0.5">*</span>
                </Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && businessName.trim()) {
                      e.preventDefault();
                      setStep(2);
                    }
                  }}
                  className="h-12 text-base bg-background"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-city" className="text-xs font-medium text-muted-foreground">
                  Unidade ou filial (opcional)
                </Label>
                <Input
                  id="unit-city"
                  value={unitCity}
                  onChange={(e) => setUnitCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && businessName.trim()) {
                      e.preventDefault();
                      setStep(2);
                    }
                  }}
                  className="h-12 text-base bg-background"
                />
              </div>

              <div className="pt-2">
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

        {/* STEP 2: ESCOLHA DO SEGMENTO */}
        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Qual é a área do seu espaço?
              </h1>
              <p className="text-muted-foreground text-sm">
                Adaptamos as opções de turmas, regras e chamada para o seu formato.
              </p>
            </div>

            {/* Grid dos 6 Segmentos Principais com Micro-copy e sem reticências */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {STANDARD_SEGMENTS.map((segId) => {
                const preset = CLASSES_SEGMENT_PRESETS[segId];
                const Icon = SEGMENT_ICONS[segId] ?? Award;
                const isSelected = selectedSegment === segId;
                return (
                  <div
                    key={preset.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectSegment(preset.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectSegment(preset.id);
                      }
                    }}
                    className={cn(
                      "group relative rounded-2xl border p-4.5 flex flex-col justify-between text-left transition-all duration-200 cursor-pointer space-y-3",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20 scale-[1.01]"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div
                          className={cn(
                            "size-9 rounded-xl flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-4.5" />
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide",
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {preset.badge}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-foreground text-sm sm:text-base group-hover:text-primary transition-colors">
                          {preset.label}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs">
                      <span className="text-[11px] font-medium text-primary/80 truncate">
                        {preset.examples}
                      </span>
                      {isSelected && (
                        <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-1">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Opção 7: Segmento Customizado / Outro Elegante */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectSegment("custom")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelectSegment("custom");
                }
              }}
              className={cn(
                "rounded-2xl border p-4 sm:p-4.5 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left",
                selectedSegment === "custom"
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                  : "border-dashed border-border/90 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    selectedSegment === "custom"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <PlusCircle className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      Outro segmento ou modalidade
                    </h3>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Personalizado
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para outros tipos de turmas, estúdios ou regras sob medida.
                  </p>
                </div>
              </div>

              {selectedSegment === "custom" && (
                <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 self-end sm:self-center">
                  <Check className="size-3 stroke-[3]" />
                </div>
              )}
            </div>

            {/* Input expandido quando customizado estiver selecionado */}
            {selectedSegment === "custom" && (
              <div className="p-4 rounded-2xl border border-primary/25 bg-card space-y-2 animate-in fade-in-50 duration-200">
                <Label
                  htmlFor="custom-segment-input"
                  className="inline-block text-xs font-bold text-foreground"
                >
                  Qual é o nome do seu segmento ou modalidade?<span className="text-primary ml-0.5">*</span>
                </Label>
                <Input
                  id="custom-segment-input"
                  value={customSegmentName}
                  onChange={(e) => setCustomSegmentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customSegmentName.trim()) {
                      e.preventDefault();
                      setStep(3);
                    }
                  }}
                  className="h-10 bg-background text-sm"
                  autoFocus
                />
              </div>
            )}

            {/* Ações Step 2 */}
            <div className="pt-2 flex items-center justify-between">
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
                disabled={selectedSegment === "custom" && !customSegmentName.trim()}
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
                    Aulas de {activePreset.label}
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
                    placeholder={getModalityPlaceholder(selectedSegment)}
                    className="h-10 text-sm bg-background"
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
