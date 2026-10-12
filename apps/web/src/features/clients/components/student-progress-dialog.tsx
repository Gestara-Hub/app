"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Calendar,
  Clock,
  Flame,
  GraduationCap,
  History,
  MessageSquarePlus,
  Pencil,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { relativeDateLabel, todayISO } from "@gestarahub/core/date";
import { getErrorMessage } from "@gestarahub/core/api-error";
import type {
  Client,
  EvaluationEntryTone,
  StudentModalityOverviewItem,
} from "@gestarahub/contracts";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BeltBadge } from "@/components/shared/belt-badge";
import {
  CRITERIA_TYPE_LABELS,
  computeNextPromotionStep,
  ageAt,
  isAgedOutOfLevel,
  levelAgeLabel,
  resolveModalityTrack,
  resolveTrackStyle,
  trackUsesAges,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useSegmentVocabulary } from "@/features/settings";
import { GraduatePanel, type GraduateResult } from "./graduate-panel";
import { StartingPointPanel, type StartingPointResult } from "./starting-point-panel";
import {
  useAddSessionEvaluation,
  usePromoteStudent,
  useSaveModalityProgression,
  useStudentProgressionOverview,
} from "../hooks/use-clients";

const STRENGTH_SUGGESTIONS = [
  "Guarda fechada",
  "Passagem de guarda",
  "Raspagem",
  "Defesa de finalização",
  "Condicionamento / Gás",
  "Quedas / Takedowns",
  "Consistência nos treinos",
];

const FOCUS_SUGGESTIONS = [
  "Base e postura",
  "Saída de 100kg",
  "Defesa de costas",
  "Transições",
  "Controle de respiração",
  "Finalização",
  "Ritmo de combate",
];

const TONE_META: Record<
  EvaluationEntryTone,
  { label: string; badgeClass: string }
> = {
  positive: {
    label: "Evolução / Ponto forte",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  attention: {
    label: "Ponto a ajustar",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  general: {
    label: "Observação de treino",
    badgeClass: "border-border bg-muted/60 text-muted-foreground",
  },
};

function formatDatePtBr(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * "Graduado hoje", "Graduado há 3 dias", "Graduado em 28 jan", "Graduado em 01/2025"
 * (`promotedOn` vem do vocabulario: "Graduado em", "Avançou em").
 */
function promotedOnLabel(promotedOn: string, iso: string): string {
  const label = relativeDateLabel(iso);
  const isRelative = /^(hoje|ontem|há |amanhã|em \d)/.test(label);
  return isRelative ? `${promotedOn.replace(/ em$/, "")} ${label}` : `${promotedOn} ${label}`;
}

function computeMonthsBetween(fromIso?: string): number {
  if (!fromIso) return 0;
  const start = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const diffDays = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  return Math.floor(diffDays / 30);
}

interface StudentProgressDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClient?: (client: Client) => void;
}

function StudentProgressDialogContent({
  client,
  onOpenChange,
  onEditClient,
}: {
  client: Client;
  onOpenChange: (open: boolean) => void;
  onEditClient?: (client: Client) => void;
}) {
  const { data: overview, isPending } = useStudentProgressionOverview(client.id);
  const saveMut = useSaveModalityProgression();
  const promoteMut = usePromoteStudent();
  const addEvalMut = useAddSessionEvaluation();
  const vocabulary = useSegmentVocabulary();

  const availableItems = useMemo(() => {
    if (!overview) return [];
    // Filtra estritamente modalidades em que o aluno faz parte da turma (matriculado)
    return overview.items
      .filter((item) => {
        const track = resolveModalityTrack(item.modality);
        return track.enabled && track.levels.length > 0 && item.isEnrolled;
      })
      .sort((a, b) => {
        return a.modality.position - b.modality.position;
      });
  }, [overview]);

  const [selectedModalityId, setSelectedModalityId] = useState<string | null>(
    null,
  );

  const activeItem: StudentModalityOverviewItem | undefined = useMemo(
    () =>
      availableItems.find((i) => i.modality.id === selectedModalityId) ??
      availableItems[0],
    [availableItems, selectedModalityId],
  );

  const activeTrack = useMemo(() => {
    if (!activeItem) return null;
    return resolveModalityTrack(activeItem.modality);
  }, [activeItem]);
  const trackStyle = resolveTrackStyle(activeTrack ?? undefined);

  // Faixa etaria por nivel: a sugestao e o aviso de troca usam a idade de hoje.
  const usesAges = trackUsesAges(activeTrack ?? undefined);
  const ageToday = ageAt(client.birthDate, todayISO());

  // Paineis "Ponto de partida" e "Graduar" (o estado de cada um fica no painel).
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [showPromotePanel, setShowPromotePanel] = useState(false);

  // Tags input state
  const [newStrength, setNewStrength] = useState("");
  const [newFocus, setNewFocus] = useState("");

  // Evaluation form state
  const [evalTone, setEvalTone] = useState<EvaluationEntryTone>("positive");
  const [evalNote, setEvalNote] = useState("");

  function handleSelectModality(modalityId: string) {
    setSelectedModalityId(modalityId);
    setShowAdjustPanel(false);
    setShowPromotePanel(false);
  }

  function handleToggleAdjustPanel() {
    setShowAdjustPanel((prev) => !prev);
    setShowPromotePanel(false);
  }

  function handleTogglePromotePanel() {
    setShowPromotePanel((prev) => !prev);
    setShowAdjustPanel(false);
  }

  const currentLevel =
    activeTrack?.levels.find(
      (l) =>
        l.id === activeItem?.progression?.levelId ||
        l.name === activeItem?.progression?.levelName,
    ) ?? activeTrack?.levels[0];
  const currentSubLevel = activeItem?.progression?.subLevel ?? 0;
  const promotedAt = activeItem?.progression?.promotedAt;

  const nextStep =
    activeTrack && currentLevel
      ? computeNextPromotionStep(activeTrack, currentLevel.id, currentSubLevel, ageToday)
      : null;
  // Passou da idade do nivel atual (ex.: fez 16 anos na Verde): precisa trocar.
  const agedOut = usesAges && isAgedOutOfLevel(currentLevel, ageToday);

  const presentSincePromotion = activeItem?.presentSincePromotion ?? 0;
  const totalPresent = activeItem?.totalPresentInModality ?? 0;
  const monthsInLevel = computeMonthsBetween(promotedAt);

  const targetAttendances = activeTrack?.targetAttendances ?? 30;
  const targetMonths = activeTrack?.targetMonths ?? 6;
  const criteriaType = activeTrack?.criteriaType ?? "attendance";

  const attendancePct =
    targetAttendances > 0
      ? Math.min(
          100,
          Math.round((presentSincePromotion / targetAttendances) * 100),
        )
      : 0;
  const timePct =
    targetMonths > 0
      ? Math.min(100, Math.round((monthsInLevel / targetMonths) * 100))
      : 0;

  const isReadyForPromotion =
    Boolean(nextStep) &&
    ((criteriaType === "attendance" &&
      presentSincePromotion >= targetAttendances) ||
      (criteriaType === "time" && monthsInLevel >= targetMonths) ||
      (criteriaType === "attendance_and_time" &&
        presentSincePromotion >= targetAttendances &&
        monthsInLevel >= targetMonths));

  const strengths = activeItem?.progression?.strengths ?? [];
  const focusAreas = activeItem?.progression?.focusAreas ?? [];
  const evaluations = activeItem?.progression?.evaluations ?? [];
  const promotionHistory = activeItem?.progression?.promotionHistory ?? [];

  async function handleSaveStartingPoint(result: StartingPointResult) {
    if (!client || !activeItem) return;
    try {
      await saveMut.mutateAsync({
        studentId: client.id,
        progression: {
          ...(activeItem.progression ?? {}),
          modalityId: activeItem.modality.id,
          modalityName: activeItem.modality.name,
          levelId: result.level.id,
          levelName: result.level.name,
          levelColor: result.level.color,
          subLevel: result.subLevel,
          maxSubLevels: result.level.maxSubLevels,
          promotedAt: result.promotedAt,
          initialAttendanceOffset: result.initialAttendanceOffset,
          origin: result.origin,
          originAcademy: result.originAcademy,
          originTeacher: result.originTeacher,
          strengths,
          focusAreas,
          evaluations,
          promotionHistory,
        },
      });
      toast.success("Ponto de partida salvo.");
      setShowAdjustPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o ponto de partida."));
    }
  }

  async function handleGraduate(result: GraduateResult) {
    if (!client || !activeItem) return;
    try {
      await promoteMut.mutateAsync({
        studentId: client.id,
        modalityId: activeItem.modality.id,
        modalityName: activeItem.modality.name,
        toLevelId: result.level.id,
        toLevelName: result.level.name,
        toLevelColor: result.level.color,
        toSubLevel: result.subLevel,
        maxSubLevels: result.level.maxSubLevels,
        date: result.date,
        attendancesCompleted: presentSincePromotion,
        monthsInLevel,
        isExam: true,
        notes: result.notes,
        examiner: result.examiner,
      });
      toast.success("Evolução registrada com sucesso!");
      setShowPromotePanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao registrar a evolução."));
    }
  }

  async function handleToggleTag(
    kind: "strengths" | "focusAreas",
    tag: string,
  ) {
    if (!client || !activeItem || !currentLevel) return;
    const trimmed = tag.trim();
    if (!trimmed) return;
    const currentList = kind === "strengths" ? strengths : focusAreas;
    const exists = currentList.includes(trimmed);
    const nextList = exists
      ? currentList.filter((t) => t !== trimmed)
      : [...currentList, trimmed];

    try {
      await saveMut.mutateAsync({
        studentId: client.id,
        progression: {
          modalityId: activeItem.modality.id,
          modalityName: activeItem.modality.name,
          levelId: currentLevel.id,
          levelName: currentLevel.name,
          levelColor: currentLevel.color,
          subLevel: currentSubLevel,
          maxSubLevels: currentLevel.maxSubLevels,
          promotedAt: promotedAt || todayISO(),
          initialAttendanceOffset:
            activeItem.progression?.initialAttendanceOffset ?? 0,
          strengths: kind === "strengths" ? nextList : strengths,
          focusAreas: kind === "focusAreas" ? nextList : focusAreas,
          evaluations,
          promotionHistory,
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao atualizar ficha técnica."));
    }
  }

  async function handleAddEvaluation() {
    if (!client || !activeItem || !evalNote.trim()) return;
    try {
      await addEvalMut.mutateAsync({
        studentId: client.id,
        modalityId: activeItem.modality.id,
        modalityName: activeItem.modality.name,
        date: todayISO(),
        tone: evalTone,
        note: evalNote.trim(),
      });
      setEvalNote("");
      toast.success("Evolução registrada no histórico do aluno.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao registrar observação."));
    }
  }


  return (
    <DialogContent
      expandable
        className="max-h-[90vh] sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 pr-20 bg-background text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <GraduationCap className="size-5 text-primary" />
                <span>{vocabulary.progressTitle} — {client.name}</span>
              </DialogTitle>
              <DialogDescription>
                Acompanhe {vocabulary.level.toLowerCase()}, presença, pontos
                fortes e diário técnico por modalidade.
              </DialogDescription>
            </div>
            {onEditClient ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  onEditClient(client);
                }}
              >
                <Pencil className="size-3.5" />
                Editar cadastro
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <DialogBody className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
          {isPending ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-9 w-64 rounded-lg" />
              <Skeleton className="h-36 w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Skeleton className="h-36 w-full rounded-xl" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
            </div>
          ) : !activeItem || !activeTrack || !currentLevel ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground space-y-2">
              <GraduationCap className="size-8 mx-auto text-muted-foreground/50" />
              <p className="font-medium text-foreground">
                Nenhuma turma com {vocabulary.trackTitle.toLowerCase()} ativa
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                O aluno não está em turmas de modalidades com {vocabulary.trackTitle.toLowerCase()} ligada.
              </p>
            </div>
          ) : (
            <>
              {/* Seletor de Modalidade */}
              {availableItems.length > 1 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Modalidade do aluno
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableItems.map((item) => {
                      const track = resolveModalityTrack(item.modality);
                      const lvl =
                        track.levels.find(
                          (l) =>
                            l.id === item.progression?.levelId ||
                            l.name === item.progression?.levelName,
                        ) ?? track.levels[0];
                      const sub = item.progression?.subLevel ?? 0;
                      const isSelected =
                        item.modality.id === activeItem.modality.id;

                      return (
                        <button
                          key={item.modality.id}
                          type="button"
                          onClick={() =>
                            handleSelectModality(item.modality.id)
                          }
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground shadow-2xs"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <span>{item.modality.name}</span>
                          {item.isEnrolled ? (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Matriculado
                            </span>
                          ) : null}
                          {/* Sem rotulo: so faz sentido com faixa ou com cor escolhida */}
                          {lvl && (resolveTrackStyle(track) === "belt" || lvl.color) ? (
                            <BeltBadge
                              name={lvl.name}
                              color={lvl.color}
                              variant={resolveTrackStyle(track)}
                              subLevel={sub}
                              maxSubLevels={lvl.maxSubLevels}
                              size="xs"
                              showLabel={false}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Passou da idade do nivel atual: precisa trocar (ex.: 16 anos na Verde) */}
              {agedOut && currentLevel ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <p>
                    Com {ageToday} anos, {currentLevel.name} não vale mais (
                    {levelAgeLabel(currentLevel)}).
                    {nextStep ? ` Sugestão: ${nextStep.nextLevel.name}.` : ""}
                  </p>
                </div>
              ) : null}

              {/* Card Principal: Nível Atual + Meta para Próxima Graduação */}
              <div className="rounded-xl border bg-card p-4 shadow-2xs space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {activeItem.modality.name}
                      </span>
                      {isReadyForPromotion ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="size-3" />
                          {vocabulary.readyBadge}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                      <BeltBadge
                        name={currentLevel.name}
                        color={currentLevel.color}
                        variant={trackStyle}
                        subLevel={currentSubLevel}
                        maxSubLevels={currentLevel.maxSubLevels}
                        size="md"
                      />
                      <span className="text-xs text-muted-foreground">
                        {promotedAt
                          ? promotedOnLabel(vocabulary.promotedOn, promotedAt)
                          : "Início da jornada"}
                      </span>
                      {activeItem.progression?.origin === "transfer" ? (
                        <span className="text-xs text-muted-foreground">
                          · Veio de {activeItem.progression.originAcademy || "outra academia"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Ponto de partida: usado uma vez por aluno, por isso discreto */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      aria-expanded={showAdjustPanel}
                      onClick={handleToggleAdjustPanel}
                    >
                      <History className="size-3.5" />
                      Ponto de partida
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      aria-expanded={showPromotePanel}
                      onClick={handleTogglePromotePanel}
                    >
                      <Award className="size-3.5" />
                      {vocabulary.promoteVerb}
                    </Button>
                  </div>
                </div>

                {/* Ponto de partida (antes "Historico inicial"): usado uma vez por aluno */}
                {showAdjustPanel ? (
                  <StartingPointPanel
                    key={`start-${activeItem.modality.id}`}
                    track={activeTrack}
                    trackStyle={trackStyle}
                    vocabulary={vocabulary}
                    birthDate={client.birthDate}
                    progression={activeItem.progression}
                    isPending={saveMut.isPending}
                    onCancel={() => setShowAdjustPanel(false)}
                    onSave={handleSaveStartingPoint}
                  />
                ) : null}

                {/* Graduar: cartoes de decisao (grau, proximo nivel ou outro) */}
                {showPromotePanel ? (
                  <GraduatePanel
                    key={`graduate-${activeItem.modality.id}-${currentLevel.id}-${currentSubLevel}`}
                    track={activeTrack}
                    trackStyle={trackStyle}
                    vocabulary={vocabulary}
                    birthDate={client.birthDate}
                    currentLevel={currentLevel}
                    currentSubLevel={currentSubLevel}
                    presentSincePromotion={presentSincePromotion}
                    monthsInLevel={monthsInLevel}
                    isPending={promoteMut.isPending}
                    onCancel={() => setShowPromotePanel(false)}
                    onConfirm={handleGraduate}
                  />
                ) : null}

                {/* Progresso da Meta (Presenças / Tempo / Exame) */}
                <div className="border-t pt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-muted-foreground">
                      Critério da modalidade:{" "}
                      <strong className="text-foreground">
                        {CRITERIA_TYPE_LABELS[criteriaType]}
                      </strong>
                    </span>
                    {nextStep ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span>Próximo passo:</span>
                        <BeltBadge
                          name={nextStep.nextLevel.name}
                          color={nextStep.nextLevel.color}
                          variant={trackStyle}
                          subLevel={nextStep.nextSubLevel}
                          maxSubLevels={nextStep.nextLevel.maxSubLevels}
                          size="xs"
                        />
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Nível máximo da trilha alcançado
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Barra de Presenças */}
                    {(criteriaType === "attendance" ||
                      criteriaType === "attendance_and_time") && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Flame className="size-3.5 text-amber-500" />
                            Presenças neste nível
                          </span>
                          <span className="font-semibold tabular-nums">
                            {presentSincePromotion} / {targetAttendances} aulas
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              attendancePct >= 100
                                ? "bg-emerald-500"
                                : "bg-primary",
                            )}
                            style={{ width: `${attendancePct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Total histórico na modalidade: {totalPresent} presença
                          {totalPresent === 1 ? "" : "s"}
                        </p>
                      </div>
                    )}

                    {/* Barra de Tempo */}
                    {(criteriaType === "time" ||
                      criteriaType === "attendance_and_time") && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Clock className="size-3.5 text-blue-500" />
                            Tempo de permanência
                          </span>
                          <span className="font-semibold tabular-nums">
                            {monthsInLevel} / {targetMonths} meses
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              timePct >= 100 ? "bg-emerald-500" : "bg-blue-500",
                            )}
                            style={{ width: `${timePct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          <span title={promotedAt ? formatDatePtBr(promotedAt) : undefined}>
                            Desde {promotedAt ? relativeDateLabel(promotedAt, { relative: false }) : "—"}
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Caso seja Avaliação Manual / Exame */}
                    {criteriaType === "manual_exam" && (
                      <div className="sm:col-span-2 flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Award className="size-4 text-primary" />
                          <span>
                            Definido por exame técnico ou avaliação do
                            professor.
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {presentSincePromotion} aula
                          {presentSincePromotion === 1 ? "" : "s"} no nível atual
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Accordions: Perfil Técnico e Diário/Histórico */}
              <Accordion type="multiple" defaultValue={[]} className="space-y-3">
                {/* Perfil Técnico: Pontos Fortes & Pontos a Melhorar */}
                <AccordionItem
                  value="technical-profile"
                  className="rounded-xl border bg-card px-4 border-b-border"
                >
                  <AccordionTrigger className="py-3.5 hover:no-underline cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Target className="size-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        Perfil Técnico & Foco de Treino
                      </span>
                    </div>
                    <span className="ml-auto mr-2 text-[11px] font-normal text-muted-foreground">
                      {strengths.length} forte{strengths.length === 1 ? "" : "s"} • {focusAreas.length} foco{focusAreas.length === 1 ? "" : "s"}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-3.5">
                      {/* Pontos Fortes */}
                      <div className="rounded-xl border bg-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <TrendingUp className="size-4" />
                            <span>Pontos Fortes / Domínio</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {strengths.length} item{strengths.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {strengths.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {strengths.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                              >
                                <span>{item}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTag("strengths", item)}
                                  className="opacity-70 hover:opacity-100"
                                  aria-label={`Remover ${item}`}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Destaque técnicas ou atributos em que o aluno se sobressai.
                          </p>
                        )}

                        <div className="flex gap-1.5">
                          <Input
                            placeholder="Adicionar ponto forte..."
                            value={newStrength}
                            onChange={(e) => setNewStrength(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newStrength.trim()) {
                                e.preventDefault();
                                handleToggleTag("strengths", newStrength);
                                setNewStrength("");
                              }
                            }}
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => {
                              if (!newStrength.trim()) return;
                              handleToggleTag("strengths", newStrength);
                              setNewStrength("");
                            }}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {STRENGTH_SUGGESTIONS.filter(
                            (s) => !strengths.includes(s),
                          )
                            .slice(0, 4)
                            .map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => handleToggleTag("strengths", sug)}
                                className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-emerald-500/40 hover:text-foreground transition-colors"
                              >
                                + {sug}
                              </button>
                            ))}
                        </div>
                      </div>

                      {/* Pontos a Melhorar */}
                      <div className="rounded-xl border bg-card p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <Target className="size-4" />
                            <span>Pontos a Melhorar / Foco</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {focusAreas.length} item{focusAreas.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {focusAreas.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {focusAreas.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                              >
                                <span>{item}</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTag("focusAreas", item)}
                                  className="opacity-70 hover:opacity-100"
                                  aria-label={`Remover ${item}`}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Defina o foco de treino atual para orientar as próximas aulas.
                          </p>
                        )}

                        <div className="flex gap-1.5">
                          <Input
                            placeholder="Adicionar foco de melhoria..."
                            value={newFocus}
                            onChange={(e) => setNewFocus(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newFocus.trim()) {
                                e.preventDefault();
                                handleToggleTag("focusAreas", newFocus);
                                setNewFocus("");
                              }
                            }}
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => {
                              if (!newFocus.trim()) return;
                              handleToggleTag("focusAreas", newFocus);
                              setNewFocus("");
                            }}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {FOCUS_SUGGESTIONS.filter((s) => !focusAreas.includes(s))
                            .slice(0, 4)
                            .map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => handleToggleTag("focusAreas", sug)}
                                className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-amber-500/40 hover:text-foreground transition-colors"
                              >
                                + {sug}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Diário de Evolução nas Sessões & Histórico de Graduações */}
                <AccordionItem
                  value="sessions-diary"
                  className="rounded-xl border bg-card px-4 border-b-border"
                >
                  <AccordionTrigger className="py-3.5 hover:no-underline cursor-pointer">
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="size-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        Diário de Sessões & Histórico de Exames
                      </span>
                    </div>
                    <span className="ml-auto mr-2 text-[11px] font-normal text-muted-foreground">
                      {promotionHistory.length + evaluations.length} registro{(promotionHistory.length + evaluations.length) === 1 ? "" : "s"}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 space-y-4">
                    {/* Novo registro rápido */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          ["positive", "attention", "general"] as EvaluationEntryTone[]
                        ).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => setEvalTone(tone)}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                              evalTone === tone
                                ? TONE_META[tone].badgeClass
                                : "border-border bg-background text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {TONE_META[tone].label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Registre uma evolução percebida na aula, ajuste técnico ou feedback de exame..."
                          value={evalNote}
                          onChange={(e) => setEvalNote(e.target.value)}
                          className="min-h-[64px] w-full text-xs"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={!evalNote.trim() || addEvalMut.isPending}
                            onClick={handleAddEvaluation}
                          >
                            Registrar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Linha do Tempo Unificada */}
                    {promotionHistory.length === 0 && evaluations.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Nenhum exame ou anotação de aula registrado nesta modalidade
                        ainda.
                      </p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {promotionHistory.map((promo) => (
                          <div
                            key={promo.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                  <Award className="size-3.5" />
                                  {vocabulary.promotion}
                                </span>
                                <BeltBadge
                                  name={promo.toLevelName}
                                  color={promo.toLevelColor}
                                  variant={trackStyle}
                                  subLevel={promo.toSubLevel}
                                  size="xs"
                                />
                                {promo.attendancesCompleted !== undefined ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    ({promo.attendancesCompleted} aulas no ciclo)
                                  </span>
                                ) : null}
                              </div>
                              {promo.examiner ? (
                                <p className="text-[11px] text-muted-foreground">Por {promo.examiner}</p>
                              ) : null}
                              {promo.notes ? (
                                <p className="text-foreground/90">{promo.notes}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="size-3" />
                              <span title={formatDatePtBr(promo.date)}>{relativeDateLabel(promo.date)}</span>
                            </span>
                          </div>
                        ))}

                        {evaluations.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.2 text-[10px] font-semibold",
                                    TONE_META[ev.tone].badgeClass,
                                  )}
                                >
                                  {TONE_META[ev.tone].label}
                                </span>
                                {ev.authorName ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    por {ev.authorName}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-foreground/90">{ev.note}</p>
                            </div>
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="size-3" />
                              <span title={formatDatePtBr(ev.date)}>{relativeDateLabel(ev.date)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}
        </DialogBody>
      </DialogContent>
  );
}

export function StudentProgressDialog({
  client,
  open,
  onOpenChange,
  onEditClient,
}: StudentProgressDialogProps) {
  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <StudentProgressDialogContent
          key={client.id}
          client={client}
          onOpenChange={onOpenChange}
          onEditClient={onEditClient}
        />
      ) : null}
    </Dialog>
  );
}
