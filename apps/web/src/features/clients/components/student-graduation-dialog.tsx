"use client";

import { useState } from "react";
import { AlertTriangle, Award, Check, GraduationCap, History, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type {
  Client,
  ModalityProgressionTrack,
  ProgressionLevelStep,
  ProgressionTrackStyle,
  StudentModalityOverviewItem,
  StudentPromotionHistoryEntry,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { relativeDateLabel, todayISO } from "@gestarahub/core/date";
import { BeltBadge } from "@/components/shared/belt-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SegmentVocabulary } from "@/lib/business-segment-presets";
import {
  ageAt,
  computeNextPromotionStep,
  isAgedOutOfLevel,
  isLevelAllowedForAge,
  levelAgeLabel,
  resolveModalityTrack,
  resolveTrackStyle,
  trackUsesAges,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useSegmentVocabulary } from "@/features/settings";
import { usePromoteStudent, useSaveModalityProgression } from "../hooks/use-clients";
import { GraduatePanel, type GraduateResult } from "./graduate-panel";
import { ModalityPicker, levelOf, monthsSince, useStudentModalities } from "./progression-ui";
import { StartingPointPanel, type StartingPointResult } from "./starting-point-panel";

/** "02/2021" (mes e ano), para datas antigas da trilha. */
function monthYear(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  return y && m ? `${m}/${y}` : iso;
}

/** "hoje", "há 3 dias", "em 28 jan", "em 01/2025" (para "1º grau hoje"). */
function whenLabel(iso: string): string {
  const label = relativeDateLabel(iso);
  return /^(hoje|ontem|há |amanhã|em \d)/.test(label) ? label : `em ${label}`;
}

/**
 * Graus como bolinhas; passar o mouse mostra a data. As bolinhas nao recebem
 * foco (o modal focaria a primeira e abriria a dica sozinho); a mesma
 * informacao vai em texto para leitor de tela.
 */
function DegreeDots({ filled, total, dates }: { filled: number; total: number; dates: Map<number, string> }) {
  if (total <= 0) return null;
  const describe = (i: number) => {
    const date = dates.get(i + 1);
    return `${i + 1}º grau${date ? ` ${whenLabel(date)}` : i < filled ? "" : ": ainda não"}`;
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">
        {filled} de {total} graus.{" "}
        {Array.from({ length: filled }, (_, i) => describe(i)).join(". ")}
      </span>
      {Array.from({ length: total }, (_, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full border",
                i < filled ? "border-foreground bg-foreground" : "border-muted-foreground/40",
              )}
            />
          </TooltipTrigger>
          <TooltipContent>{describe(i)}</TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}

function ProgressLine({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {value} de {target} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Situacao do nivel atual: progresso pelo criterio, proximo passo e Graduar. */
function CurrentLevelDetails({
  track,
  style,
  vocabulary,
  item,
  currentLevel,
  subLevel,
  age,
  onGraduate,
}: {
  track: ModalityProgressionTrack;
  style: ProgressionTrackStyle;
  vocabulary: SegmentVocabulary;
  item: StudentModalityOverviewItem;
  currentLevel: ProgressionLevelStep;
  subLevel: number;
  age: number | null;
  onGraduate: () => void;
}) {
  const criteria = track.criteriaType ?? "attendance";
  const targetAttendances = track.targetAttendances ?? 30;
  const targetMonths = track.targetMonths ?? 6;
  const present = item.presentSincePromotion;
  const months = monthsSince(item.progression?.promotedAt);
  const next = computeNextPromotionStep(track, currentLevel.id, subLevel, trackUsesAges(track) ? age : null);
  const ready =
    Boolean(next) &&
    ((criteria === "attendance" && present >= targetAttendances) ||
      (criteria === "time" && months >= targetMonths) ||
      (criteria === "attendance_and_time" && present >= targetAttendances && months >= targetMonths));

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      {criteria === "manual_exam" ? (
        <p className="text-[11px] text-muted-foreground">
          Por avaliação do professor · {present} {present === 1 ? "aula" : "aulas"} {vocabulary.inLevel}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {criteria === "attendance" || criteria === "attendance_and_time" ? (
            <ProgressLine label="Aulas" value={present} target={targetAttendances} unit="aulas" />
          ) : null}
          {criteria === "time" || criteria === "attendance_and_time" ? (
            <ProgressLine label="Tempo" value={months} target={targetMonths} unit="meses" />
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {next ? (
            <>
              Próximo:
              <BeltBadge
                name={next.nextLevel.name}
                color={next.nextLevel.color}
                variant={style}
                subLevel={next.nextSubLevel}
                maxSubLevels={next.nextLevel.maxSubLevels}
                size="xs"
              />
            </>
          ) : (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Último nível da trilha</span>
          )}
          {ready ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="size-3" />
              {vocabulary.readyBadge}
            </span>
          ) : null}
        </span>
        <Button type="button" size="sm" className="gap-1.5" onClick={onGraduate}>
          <Award className="size-4" />
          {vocabulary.promoteVerb}
        </Button>
      </div>
    </div>
  );
}

/**
 * Trilha inteira em pe ("Jornada"): niveis conquistados com data e quem
 * graduou, o atual em destaque com o progresso, os proximos apagados.
 */
function Journey({
  track,
  style,
  vocabulary,
  item,
  age,
  onGraduate,
}: {
  track: ModalityProgressionTrack;
  style: ProgressionTrackStyle;
  vocabulary: SegmentVocabulary;
  item: StudentModalityOverviewItem;
  age: number | null;
  onGraduate: () => void;
}) {
  const progression = item.progression;
  const currentLevel = levelOf(track, progression);
  if (!currentLevel) return null;
  const subLevel = progression?.subLevel ?? 0;
  const history: StudentPromotionHistoryEntry[] = progression?.promotionHistory ?? [];
  const usesAges = trackUsesAges(track) && age !== null;
  const currentIndex = track.levels.findIndex((l) => l.id === currentLevel.id);
  const reached = new Set(history.map((h) => h.toLevelName));
  const origin = progression?.origin;
  const beforeLabel =
    origin === "transfer" ? `Veio de ${progression?.originAcademy || "outra academia"}` : "Antes do sistema";
  // Nivel em que comecou no sistema: nao aparece no historico (so as graduacoes).
  const oldest = [...history].sort((a, b) => a.date.localeCompare(b.date))[0];
  const startLevelName = origin === "transfer" || origin === "before_system" ? undefined : oldest?.fromLevelName;

  const visible = track.levels
    .map((level, index) => ({ level, index }))
    .filter(
      ({ level, index }) =>
        index === currentIndex || reached.has(level.name) || !usesAges || isLevelAllowedForAge(level, age),
    );

  return (
    <ol className="relative space-y-2 before:absolute before:top-4 before:bottom-4 before:left-[15px] before:w-px before:bg-border">
      {visible.map(({ level, index }) => {
        const entries = history
          .filter((h) => h.toLevelName === level.name)
          .sort((a, b) => a.date.localeCompare(b.date));
        const first = entries[0];
        const degreeDates = new Map(entries.filter((h) => h.toSubLevel > 0).map((h) => [h.toSubLevel, h.date]));
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;
        const since = isCurrent ? (first?.date ?? progression?.promotedAt) : first?.date;
        const pastDegrees = Math.max(0, ...entries.map((h) => h.toSubLevel));

        let caption: string;
        if (isCurrent) caption = since ? `Desde ${relativeDateLabel(since)}` : "Início da jornada";
        else if (isPast) caption = first ? monthYear(first.date) : level.name === startLevelName ? "Começou aqui" : beforeLabel;
        else caption = "";
        const examiner = first?.examiner;

        return (
          <li key={level.id} className="relative flex gap-3">
            <span
              className={cn(
                "z-10 mt-1.5 flex size-[31px] shrink-0 items-center justify-center rounded-full border bg-background",
                isCurrent ? "border-primary ring-4 ring-primary/15" : isPast ? "border-foreground/40" : "border-dashed",
              )}
              aria-hidden
            >
              {isPast ? (
                <Check className="size-3.5" />
              ) : isCurrent ? (
                <Award className="size-3.5 text-primary" />
              ) : (
                <Lock className="size-3 text-muted-foreground" />
              )}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-xl border px-3 py-2.5",
                isCurrent ? "border-primary/40 bg-primary/[0.03]" : isPast ? "bg-card" : "border-dashed opacity-60",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <BeltBadge
                  name={level.name}
                  color={level.color}
                  variant={style}
                  subLevel={isCurrent ? subLevel : isPast ? pastDegrees : 0}
                  maxSubLevels={level.maxSubLevels}
                  size="sm"
                />
                {caption ? (
                  <span className="text-[11px] text-muted-foreground">
                    {caption}
                    {examiner && (isPast || isCurrent) ? ` · ${examiner}` : ""}
                  </span>
                ) : null}
              </div>
              {isCurrent && level.maxSubLevels > 0 ? (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{style === "belt" ? "Graus" : "Etapas"}</span>
                  <DegreeDots filled={subLevel} total={level.maxSubLevels} dates={degreeDates} />
                </div>
              ) : null}
              {isCurrent ? (
                <CurrentLevelDetails
                  track={track}
                  style={style}
                  vocabulary={vocabulary}
                  item={item}
                  currentLevel={currentLevel}
                  subLevel={subLevel}
                  age={age}
                  onGraduate={onGraduate}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function GraduationContent({
  client,
  initialModalityId,
}: {
  client: Client;
  initialModalityId?: string;
}) {
  const vocabulary = useSegmentVocabulary();
  const { isPending, items, active, select } = useStudentModalities(client.id, initialModalityId);
  const saveMut = useSaveModalityProgression();
  const promoteMut = usePromoteStudent();
  const [panel, setPanel] = useState<"graduate" | "start" | null>(null);

  const track = active ? resolveModalityTrack(active.modality) : null;
  const style = resolveTrackStyle(track ?? undefined);
  const progression = active?.progression;
  const currentLevel = track ? levelOf(track, progression) : undefined;
  const subLevel = progression?.subLevel ?? 0;
  const age = ageAt(client.birthDate, todayISO());
  const agedOut = Boolean(track && trackUsesAges(track) && isAgedOutOfLevel(currentLevel, age));
  const next =
    track && currentLevel ? computeNextPromotionStep(track, currentLevel.id, subLevel, age) : null;

  async function handleGraduate(result: GraduateResult) {
    if (!active) return;
    try {
      await promoteMut.mutateAsync({
        studentId: client.id,
        modalityId: active.modality.id,
        modalityName: active.modality.name,
        toLevelId: result.level.id,
        toLevelName: result.level.name,
        toLevelColor: result.level.color,
        toSubLevel: result.subLevel,
        maxSubLevels: result.level.maxSubLevels,
        date: result.date,
        attendancesCompleted: active.presentSincePromotion,
        monthsInLevel: monthsSince(progression?.promotedAt),
        isExam: true,
        notes: result.notes,
        examiner: result.examiner,
      });
      toast.success(`Registrado: ${result.level.name}${result.subLevel > 0 ? ` · ${result.subLevel}º grau` : ""}.`);
      setPanel(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível registrar. Tente novamente."));
    }
  }

  async function handleStartingPoint(result: StartingPointResult) {
    if (!active) return;
    try {
      await saveMut.mutateAsync({
        studentId: client.id,
        progression: {
          strengths: [],
          goals: [],
          evaluations: [],
          promotionHistory: [],
          ...(progression ?? {}),
          modalityId: active.modality.id,
          modalityName: active.modality.name,
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
        },
      });
      toast.success("Ponto de partida salvo.");
      setPanel(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o ponto de partida."));
    }
  }

  const ready = Boolean(active && track && currentLevel);
  // Graduar e Ponto de partida trocam o corpo do modal (titulo, corpo e rodape fixo).
  const activePanel = ready ? panel : null;
  const title =
    activePanel === "graduate"
      ? `Registrar ${vocabulary.promotionLower}`
      : activePanel === "start"
        ? "Ponto de partida"
        : vocabulary.levelsTitle;

  return (
    <DialogContent expandable className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-20 text-left">
        <DialogTitle className="flex items-center gap-2">
          {activePanel === "graduate" ? (
            <Award className="size-5 text-primary" />
          ) : activePanel === "start" ? (
            <History className="size-5 text-primary" />
          ) : (
            <GraduationCap className="size-5 text-primary" />
          )}
          {title}
        </DialogTitle>
        <DialogDescription>
          {client.name}
          {active ? ` · ${active.modality.name}` : ""}
        </DialogDescription>
      </DialogHeader>

      {activePanel === "graduate" && active && track && currentLevel ? (
        <GraduatePanel
          key={`graduate-${active.modality.id}-${currentLevel.id}-${subLevel}`}
          track={track}
          trackStyle={style}
          vocabulary={vocabulary}
          birthDate={client.birthDate}
          currentLevel={currentLevel}
          currentSubLevel={subLevel}
          presentSincePromotion={active.presentSincePromotion}
          monthsInLevel={monthsSince(progression?.promotedAt)}
          isPending={promoteMut.isPending}
          onCancel={() => setPanel(null)}
          onConfirm={handleGraduate}
        />
      ) : activePanel === "start" && active && track ? (
        <StartingPointPanel
          key={`start-${active.modality.id}`}
          track={track}
          trackStyle={style}
          vocabulary={vocabulary}
          birthDate={client.birthDate}
          progression={progression}
          isPending={saveMut.isPending}
          onCancel={() => setPanel(null)}
          onSave={handleStartingPoint}
        />
      ) : (
        <DialogBody className="space-y-4">
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : !active || !track || !currentLevel ? (
            <div className="space-y-2 rounded-xl border border-dashed p-8 text-center">
              <GraduationCap className="mx-auto size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Nenhuma turma com {vocabulary.trackTitle.toLowerCase()} ativa
              </p>
              <p className="mx-auto max-w-md text-xs text-muted-foreground">
                O aluno não está em turmas de modalidades com {vocabulary.trackTitle.toLowerCase()} ligada.
              </p>
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <ModalityPicker
                items={items}
                activeId={active.modality.id}
                onSelect={(id) => {
                  select(id);
                  setPanel(null);
                }}
              />

              {agedOut ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <p>
                    Com {age} anos, {currentLevel.name} não vale mais ({levelAgeLabel(currentLevel)}).
                    {next ? ` Sugestão: ${next.nextLevel.name}.` : ""}
                  </p>
                </div>
              ) : null}

              <Journey
                track={track}
                style={style}
                vocabulary={vocabulary}
                item={active}
                age={age}
                onGraduate={() => setPanel("graduate")}
              />
              <button
                type="button"
                onClick={() => setPanel("start")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="size-3.5" />
                Ajustar ponto de partida
              </button>
            </TooltipProvider>
          )}
        </DialogBody>
      )}
    </DialogContent>
  );
}

/** Modal de Graduação (raro): a trilha do aluno, graduar e ponto de partida. */
export function StudentGraduationDialog({
  client,
  open,
  onOpenChange,
  initialModalityId,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialModalityId?: string;
}) {
  if (!client) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <GraduationContent key={client.id} client={client} initialModalityId={initialModalityId} /> : null}
    </Dialog>
  );
}
