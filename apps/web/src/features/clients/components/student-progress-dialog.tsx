"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  GraduationCap,
  MessageSquarePlus,
  Pencil,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@gestarahub/core/date";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BeltBadge } from "@/components/shared/belt-badge";
import {
  CRITERIA_TYPE_LABELS,
  computeNextPromotionStep,
  resolveModalityTrack,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
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

  // Manual level adjustment panel state
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [adjustLevelId, setAdjustLevelId] = useState("");
  const [adjustSubLevel, setAdjustSubLevel] = useState(0);
  const [adjustPromotedAt, setAdjustPromotedAt] = useState(todayISO());
  const [adjustOffset, setAdjustOffset] = useState(0);

  // Promotion / Exam panel state
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [targetLevelId, setTargetLevelId] = useState("");
  const [targetSubLevel, setTargetSubLevel] = useState(0);
  const [promoteDate, setPromoteDate] = useState(todayISO());
  const [promoteNotes, setPromoteNotes] = useState("");

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
    if (!showAdjustPanel && activeItem && activeTrack) {
      const defaultLevel = activeTrack.levels[0];
      const matchedLvl =
        activeTrack.levels.find(
          (l) =>
            l.id === activeItem.progression?.levelId ||
            l.name === activeItem.progression?.levelName,
        ) ?? defaultLevel;
      setAdjustLevelId(matchedLvl?.id ?? "");
      setAdjustSubLevel(activeItem.progression?.subLevel ?? 0);
      setAdjustPromotedAt(activeItem.progression?.promotedAt ?? todayISO());
      setAdjustOffset(activeItem.progression?.initialAttendanceOffset ?? 0);
    }
    setShowAdjustPanel((prev) => !prev);
    setShowPromotePanel(false);
  }

  function handleTogglePromotePanel() {
    if (!showPromotePanel && activeItem && activeTrack) {
      const defaultLevel = activeTrack.levels[0];
      const matchedLvl =
        activeTrack.levels.find(
          (l) =>
            l.id === activeItem.progression?.levelId ||
            l.name === activeItem.progression?.levelName,
        ) ?? defaultLevel;
      const currentLvlId = matchedLvl?.id ?? "";
      const currentSub = activeItem.progression?.subLevel ?? 0;
      const step = computeNextPromotionStep(
        activeTrack,
        currentLvlId,
        currentSub,
      );
      setTargetLevelId(step?.nextLevel.id ?? currentLvlId);
      setTargetSubLevel(step?.nextSubLevel ?? currentSub);
      setPromoteDate(todayISO());
      setPromoteNotes("");
    }
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
      ? computeNextPromotionStep(activeTrack, currentLevel.id, currentSubLevel)
      : null;

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

  async function handleSaveManualAdjustment() {
    if (!client || !activeItem || !activeTrack) return;
    const targetLvl =
      activeTrack.levels.find((l) => l.id === adjustLevelId) ??
      activeTrack.levels[0];
    if (!targetLvl) return;

    try {
      await saveMut.mutateAsync({
        studentId: client.id,
        progression: {
          modalityId: activeItem.modality.id,
          modalityName: activeItem.modality.name,
          levelId: targetLvl.id,
          levelName: targetLvl.name,
          levelColor: targetLvl.color,
          subLevel: adjustSubLevel,
          maxSubLevels: targetLvl.maxSubLevels,
          promotedAt: adjustPromotedAt || todayISO(),
          initialAttendanceOffset: Math.max(0, Number(adjustOffset) || 0),
          strengths,
          focusAreas,
          evaluations,
          promotionHistory,
        },
      });
      toast.success("Histórico inicial atualizado com sucesso!");
      setShowAdjustPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao atualizar graduação."));
    }
  }

  async function handlePromote() {
    if (!client || !activeItem || !activeTrack || !targetLevelId) return;
    const targetLvl = activeTrack.levels.find((l) => l.id === targetLevelId);
    if (!targetLvl) return;

    try {
      await promoteMut.mutateAsync({
        studentId: client.id,
        modalityId: activeItem.modality.id,
        modalityName: activeItem.modality.name,
        toLevelId: targetLvl.id,
        toLevelName: targetLvl.name,
        toLevelColor: targetLvl.color,
        toSubLevel: targetSubLevel,
        maxSubLevels: targetLvl.maxSubLevels,
        date: promoteDate || todayISO(),
        attendancesCompleted: presentSincePromotion,
        monthsInLevel,
        isExam: true,
        notes: promoteNotes.trim() || undefined,
      });
      toast.success("Graduação registrada com sucesso!");
      setShowPromotePanel(false);
      setPromoteNotes("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao registrar graduação."));
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

  const adjustSelectedLevel = activeTrack?.levels.find(
    (l) => l.id === adjustLevelId,
  );
  const promoteSelectedLevel = activeTrack?.levels.find(
    (l) => l.id === targetLevelId,
  );

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
                <span>Evolução e Graduação — {client.name}</span>
              </DialogTitle>
              <DialogDescription>
                Acompanhe faixa, graus, presença para exame, pontos fortes e
                diário técnico por modalidade.
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
                Nenhuma matrícula em turma com graduação ativa
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Este aluno não está matriculado em turmas de modalidades com trilha de graduação habilitada.
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
                          {lvl ? (
                            <BeltBadge
                              name={lvl.name}
                              color={lvl.color}
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
                          Apto para graduação / exame
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                      <BeltBadge
                        name={currentLevel.name}
                        color={currentLevel.color}
                        subLevel={currentSubLevel}
                        maxSubLevels={currentLevel.maxSubLevels}
                        size="md"
                      />
                      <span className="text-xs text-muted-foreground">
                        {promotedAt
                          ? `Graduado em ${formatDatePtBr(promotedAt)}`
                          : "Início da jornada"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleToggleAdjustPanel}
                    >
                      {showAdjustPanel ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                      Editar histórico inicial
                    </Button>
                    {nextStep ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleTogglePromotePanel}
                      >
                        <Award className="size-3.5" />
                        Graduar / Exame
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Painel de Ajuste de Histórico / Ponto de Partida Inicial */}
                {showAdjustPanel ? (
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Histórico Inicial e Ponto de Partida
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Defina a faixa atual do aluno e eventuais presenças já acumuladas antes do sistema ou em outra academia.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdjustPanel(false)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Fechar painel"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {/* Faixa / Nível atual */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Faixa / Nível atual
                        </label>
                        <Select
                          value={adjustLevelId}
                          onValueChange={(value) => {
                            setAdjustLevelId(value);
                            setAdjustSubLevel(0);
                          }}
                        >
                          <SelectTrigger className="h-9 w-full text-xs">
                            <SelectValue placeholder="Selecione a faixa/nível" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeTrack.levels.map((lvl) => (
                              <SelectItem
                                key={lvl.id}
                                value={lvl.id}
                                className="text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <BeltBadge
                                    name={lvl.name}
                                    color={lvl.color}
                                    size="xs"
                                    showLabel={false}
                                  />
                                  <span>{lvl.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Graus na faixa (se a modalidade tiver graus) */}
                      {adjustSelectedLevel &&
                      adjustSelectedLevel.maxSubLevels > 0 ? (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Grau atual
                          </label>
                          <Select
                            value={String(adjustSubLevel)}
                            onValueChange={(value) =>
                              setAdjustSubLevel(Number(value))
                            }
                          >
                            <SelectTrigger className="h-9 w-full text-xs">
                              <SelectValue placeholder="Selecione o grau" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" className="text-xs">
                                Sem grau (Liso)
                              </SelectItem>
                              {Array.from({
                                length: adjustSelectedLevel.maxSubLevels,
                              }).map((_, idx) => (
                                <SelectItem
                                  key={idx + 1}
                                  value={String(idx + 1)}
                                  className="text-xs"
                                >
                                  {idx + 1}º grau
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {/* Data da graduação */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Data desta graduação
                        </label>
                        <Input
                          type="date"
                          value={adjustPromotedAt}
                          onChange={(e) => setAdjustPromotedAt(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* Presenças já acumuladas */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Presenças já acumuladas nesta faixa
                          </label>
                          {targetAttendances > 0 ? (
                            <span className="text-[10px] text-muted-foreground">
                              Meta: {targetAttendances} aulas
                            </span>
                          ) : null}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={adjustOffset}
                          onChange={(e) =>
                            setAdjustOffset(Math.max(0, Number(e.target.value)))
                          }
                          className="h-9 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Aulas realizadas antes do uso do GestaraHub ou em outra academia.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setShowAdjustPanel(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={saveMut.isPending}
                        onClick={handleSaveManualAdjustment}
                      >
                        Salvar histórico
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Painel de Graduação / Registro de Exame */}
                {showPromotePanel ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-primary" />
                        <p className="text-xs font-semibold text-foreground">
                          Registrar Graduação / Exame de Faixa
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPromotePanel(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Nova Faixa / Nível
                        </label>
                        <Select
                          value={targetLevelId}
                          onValueChange={(value) => {
                            setTargetLevelId(value);
                            setTargetSubLevel(0);
                          }}
                        >
                          <SelectTrigger className="h-9 w-full text-xs">
                            <SelectValue placeholder="Selecione a nova faixa" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeTrack.levels.map((lvl) => (
                              <SelectItem
                                key={lvl.id}
                                value={lvl.id}
                                className="text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <BeltBadge
                                    name={lvl.name}
                                    color={lvl.color}
                                    size="xs"
                                    showLabel={false}
                                  />
                                  <span>{lvl.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {promoteSelectedLevel &&
                      promoteSelectedLevel.maxSubLevels > 0 ? (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Novo Grau
                          </label>
                          <Select
                            value={String(targetSubLevel)}
                            onValueChange={(value) =>
                              setTargetSubLevel(Number(value))
                            }
                          >
                            <SelectTrigger className="h-9 w-full text-xs">
                              <SelectValue placeholder="Selecione o grau" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" className="text-xs">
                                Sem grau (Liso)
                              </SelectItem>
                              {Array.from({
                                length: promoteSelectedLevel.maxSubLevels,
                              }).map((_, idx) => (
                                <SelectItem
                                  key={idx + 1}
                                  value={String(idx + 1)}
                                  className="text-xs"
                                >
                                  {idx + 1}º grau
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Data do exame / graduação
                        </label>
                        <Input
                          type="date"
                          value={promoteDate}
                          onChange={(e) => setPromoteDate(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Observação do exame / avaliador (opcional)
                      </label>
                      <Input
                        placeholder="Ex.: Exame com Mestre Carlos — excelente guarda e postura"
                        value={promoteNotes}
                        onChange={(e) => setPromoteNotes(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {promoteSelectedLevel ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Resultado:</span>
                          <BeltBadge
                            name={promoteSelectedLevel.name}
                            color={promoteSelectedLevel.color}
                            subLevel={targetSubLevel}
                            maxSubLevels={promoteSelectedLevel.maxSubLevels}
                            size="xs"
                          />
                        </div>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setShowPromotePanel(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={promoteMut.isPending}
                          onClick={handlePromote}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Confirmar graduação
                        </Button>
                      </div>
                    </div>
                  </div>
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
                          Desde {formatDatePtBr(promotedAt)}
                        </p>
                      </div>
                    )}

                    {/* Caso seja Avaliação Manual / Exame */}
                    {criteriaType === "manual_exam" && (
                      <div className="sm:col-span-2 flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Award className="size-4 text-primary" />
                          <span>
                            Graduação definida por exame técnico ou avaliação do
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
                                  Graduação / Exame
                                </span>
                                <BeltBadge
                                  name={promo.toLevelName}
                                  color={promo.toLevelColor}
                                  subLevel={promo.toSubLevel}
                                  size="xs"
                                />
                                {promo.attendancesCompleted !== undefined ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    ({promo.attendancesCompleted} aulas no ciclo)
                                  </span>
                                ) : null}
                              </div>
                              {promo.notes ? (
                                <p className="text-foreground/90">{promo.notes}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="size-3" />
                              {formatDatePtBr(promo.date)}
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
                              {formatDatePtBr(ev.date)}
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
