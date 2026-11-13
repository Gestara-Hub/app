"use client";

import { useTeamWords } from "@/features/settings";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Award } from "lucide-react";
import type {
  ModalityProgressionTrack,
  ProgressionCriteriaType,
  ProgressionLevelStep,
  ProgressionTrackStyle,
  StudentStageGrades,
} from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { promotionReadiness } from "@gestarahub/core/progression";
import { BeltBadge } from "@/components/shared/belt-badge";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SegmentVocabulary } from "@/lib/business-segment-presets";
import {
  ageAt,
  computeNextPromotionStep,
  isLevelAllowedForAge,
  levelAgeLabel,
  trackUsesAges,
} from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { GoalRow, StageGradeRows } from "./progression-ui";

export interface GraduateResult {
  level: ProgressionLevelStep;
  subLevel: number;
  date: string;
  examiner?: string;
  notes?: string;
}

/**
 * Select de faixa/nivel no mesmo padrao do cadastro de modalidades (Select do
 * design system, com a amostra da faixa). Niveis de outra idade aparecem com aviso.
 */
export function LevelSelect({
  id,
  levels,
  value,
  onChange,
  trackStyle,
  age,
  usesAges,
  placeholder,
}: {
  id: string;
  levels: ProgressionLevelStep[];
  value: string;
  onChange: (levelId: string) => void;
  trackStyle: ProgressionTrackStyle;
  age: number | null;
  usesAges: boolean;
  placeholder: string;
}) {
  const selected = levels.find((l) => l.id === value);
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} className="h-9 w-full bg-background text-sm">
        <SelectValue placeholder={placeholder}>
          {selected ? (
            <span className="flex items-center gap-2">
              <BeltBadge
                name={selected.name}
                color={selected.color}
                variant={trackStyle}
                size="xs"
                showLabel={false}
              />
              {selected.name}
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {levels.map((l) => {
          const outOfAge = usesAges && !isLevelAllowedForAge(l, age);
          return (
            <SelectItem key={l.id} value={l.id} className="text-sm">
              <span className="flex items-center gap-2">
                <BeltBadge
                  name={l.name}
                  color={l.color}
                  variant={trackStyle}
                  size="xs"
                  showLabel={false}
                />
                <span>{l.name}</span>
                {outOfAge ? (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    · fora da idade ({levelAgeLabel(l)})
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Botoes de grau: "Liso", "1º", "2º"... */
export function DegreePicker({
  max,
  value,
  onChange,
  minSelectable = 0,
  disabled,
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  minSelectable?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: max + 1 }).map((_, g) => (
        <button
          key={g}
          type="button"
          disabled={disabled || g < minSelectable}
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          title={g === 0 ? "Sem grau (liso)" : `${g}º grau`}
          className={cn(
            "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium tabular-nums transition-colors disabled:opacity-40",
            value === g
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-accent",
          )}
        >
          {g === 0 ? "Liso" : `${g}º`}
        </button>
      ))}
    </div>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  level,
  sub,
  tag,
  trackStyle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  level: ProgressionLevelStep;
  sub: number;
  tag?: string;
  trackStyle: ProgressionTrackStyle;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-background hover:bg-accent/50",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
        {title}
        {tag ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {tag}
          </span>
        ) : null}
      </span>
      <BeltBadge
        name={level.name}
        color={level.color}
        variant={trackStyle}
        subLevel={sub}
        maxSubLevels={level.maxSubLevels}
        size="xs"
      />
    </button>
  );
}

/**
 * "Graduar" (cartoes de decisao): dar o proximo grau, trocar para a proxima
 * faixa/nivel ou escolher outro (exame, transferencia, correcao). Mostra a meta
 * (aulas e tempo), so os niveis da idade do aluno e o antes -> depois.
 */
export function GraduatePanel({
  track,
  trackStyle,
  vocabulary,
  birthDate,
  currentLevel,
  currentSubLevel,
  presentSincePromotion,
  monthsInLevel,
  stageGrades,
  isPending,
  onCancel,
  onConfirm,
}: {
  track: ModalityProgressionTrack;
  trackStyle: ProgressionTrackStyle;
  vocabulary: SegmentVocabulary;
  birthDate?: string;
  currentLevel: ProgressionLevelStep;
  currentSubLevel: number;
  presentSincePromotion: number;
  monthsInLevel: number;
  /** Com avaliacoes na modalidade: media e frequencia da etapa entram na meta (doc product/30 §1). */
  stageGrades?: StudentStageGrades;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (result: GraduateResult) => void;
}) {
  const team = useTeamWords();
  const isBelt = trackStyle === "belt";
  // `vocabulary` ja e o da trilha (faixa no estilo faixa, nivel/modulo/fase nas demais).
  const levelWord = vocabulary.level.toLowerCase();
  const usesAges = trackUsesAges(track);
  const [date, setDate] = useState(todayISO());
  const age = ageAt(birthDate, date || todayISO());
  const allowedForAge = (l: ProgressionLevelStep) => !usesAges || isLevelAllowedForAge(l, age);

  const currentIndex = track.levels.findIndex((l) => l.id === currentLevel.id);
  const canGetDegree =
    currentSubLevel < currentLevel.maxSubLevels && allowedForAge(currentLevel);
  const nextLevel = track.levels.slice(currentIndex + 1).find(allowedForAge);
  const suggested = computeNextPromotionStep(track, currentLevel.id, currentSubLevel, usesAges ? age : null);
  const suggestedChoice = suggested?.isNewBelt ? "level" : "degree";

  type Choice = "degree" | "level" | "other";
  const [choice, setChoice] = useState<Choice>(
    canGetDegree ? suggestedChoice : nextLevel ? "level" : "other",
  );
  const [showAll, setShowAll] = useState(false);
  const otherOptions = showAll || !usesAges ? track.levels : track.levels.filter(allowedForAge);
  const [otherId, setOtherId] = useState(otherOptions[0]?.id ?? currentLevel.id);
  const [otherSub, setOtherSub] = useState(0);
  const [examiner, setExaminer] = useState("");
  const [notes, setNotes] = useState("");

  const target: { level: ProgressionLevelStep; sub: number } | null =
    choice === "degree"
      ? { level: currentLevel, sub: currentSubLevel + 1 }
      : choice === "level" && nextLevel
        ? { level: nextLevel, sub: 0 }
        : choice === "other"
          ? {
              level: track.levels.find((l) => l.id === otherId) ?? currentLevel,
              sub: otherSub,
            }
          : null;

  const criteria: ProgressionCriteriaType = track.criteriaType;
  const targetAttendances = track.targetAttendances ?? 30;
  const targetMonths = track.targetMonths ?? 6;
  const attendanceOk = presentSincePromotion >= targetAttendances;
  const timeOk = monthsInLevel >= targetMonths;
  const showAttendance = criteria === "attendance" || criteria === "attendance_and_time";
  const showTime = criteria === "time" || criteria === "attendance_and_time";
  // Mesma regra do selo "Apto" (aulas, tempo, nota e frequencia).
  const goalMet =
    promotionReadiness({
      criteriaType: criteria,
      targetAttendances,
      targetMonths,
      presentSincePromotion,
      monthsInLevel,
      hasNextStep: true,
      grades: stageGrades,
    }).gaps.length === 0;

  const otherLevel = track.levels.find((l) => l.id === otherId);
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // Mesmo nivel e grau de hoje: nada a registrar.
  const unchanged = Boolean(
    target && target.level.id === currentLevel.id && target.sub === currentSubLevel,
  );
  const otherOutOfAge = usesAges && otherLevel && !isLevelAllowedForAge(otherLevel, age);

  // Corpo e rodape do modal (padrao: corpo rola, rodape fixo); o titulo vem do modal.
  return (
    <>
      <DialogBody className="space-y-4">
      {/* Decisao: grau, proximo nivel ou outro */}
      <div className="grid gap-2 sm:grid-cols-3">
        {canGetDegree ? (
          <ChoiceCard
            selected={choice === "degree"}
            onSelect={() => setChoice("degree")}
            trackStyle={trackStyle}
            title={`Dar o ${currentSubLevel + 1}º grau`}
            level={currentLevel}
            sub={currentSubLevel + 1}
            tag={suggestedChoice === "degree" ? "Sugerido" : undefined}
          />
        ) : null}
        {nextLevel ? (
          <ChoiceCard
            selected={choice === "level"}
            onSelect={() => setChoice("level")}
            trackStyle={trackStyle}
            title={isBelt ? `Trocar de ${levelWord}` : `Avançar de ${levelWord}`}
            level={nextLevel}
            sub={0}
            tag={!canGetDegree || suggestedChoice === "level" ? "Sugerido" : undefined}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setChoice("other")}
          aria-pressed={choice === "other"}
          className={cn(
            "flex flex-col items-start gap-1 rounded-xl border border-dashed p-3 text-left transition-colors",
            choice === "other"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-background hover:bg-accent/50",
          )}
        >
          <span className="text-sm font-medium">Escolher outra</span>
          <span className="text-[11px] text-muted-foreground">Exame, transferência ou correção</span>
        </button>
      </div>

      {choice === "other" ? (
        <div className="grid gap-3 rounded-xl border border-border/60 bg-background p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="graduate-other-level" className="text-sm font-medium text-foreground">
              {vocabulary.level}
            </label>
            <LevelSelect
              id="graduate-other-level"
              levels={otherOptions}
              value={otherId}
              onChange={(v) => {
                setOtherId(v);
                setOtherSub(0);
              }}
              trackStyle={trackStyle}
              age={age}
              usesAges={usesAges}
              placeholder={vocabulary.selectLevel}
            />
            {usesAges ? (
              age === null ? (
                <p className="text-[11px] text-muted-foreground">
                  Cadastre a data de nascimento para filtrar pela idade.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {showAll ? `Mostrar só para ${age} anos` : `Mostrar todas as ${vocabulary.levelPlural.toLowerCase()}`}
                </button>
              )
            ) : null}
            {otherOutOfAge ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Fora da faixa etária ({levelAgeLabel(otherLevel)}). O aluno tem {age} anos.
              </p>
            ) : null}
          </div>
          {otherLevel && otherLevel.maxSubLevels > 0 ? (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Grau</span>
              <DegreePicker max={otherLevel.maxSubLevels} value={otherSub} onChange={setOtherSub} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Antes -> depois em destaque: o que muda com esta graduacao */}
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border p-4 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6",
          unchanged ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-primary/25 bg-background",
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hoje</span>
          <BeltBadge
            name={currentLevel.name}
            color={currentLevel.color}
            variant={trackStyle}
            subLevel={currentSubLevel}
            maxSubLevels={currentLevel.maxSubLevels}
            size="md"
          />
        </div>
        <ArrowRight className="size-5 rotate-90 text-muted-foreground sm:rotate-0" />
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">Depois</span>
          {target ? (
            <BeltBadge
              name={target.level.name}
              color={target.level.color}
              variant={trackStyle}
              subLevel={target.sub}
              maxSubLevels={target.level.maxSubLevels}
              size="md"
            />
          ) : null}
        </div>
        {unchanged ? (
          <p className="text-xs text-amber-700 sm:basis-full sm:text-center dark:text-amber-400">
            É igual ao atual. Escolha outra {levelWord} ou outro grau.
          </p>
        ) : null}
      </div>

      {/* Meta da faixa/nivel atual (com notas: media e frequencia da etapa) */}
      {criteria === "manual_exam" && !stageGrades ? (
        <p className="rounded-xl border border-border/60 bg-background p-3 text-xs text-muted-foreground">
          Definido por avaliação do professor. {presentSincePromotion}{" "}
          {presentSincePromotion === 1 ? "aula" : "aulas"} desde a última {vocabulary.promotionLower}.
        </p>
      ) : (
        <div className="space-y-2 rounded-xl border border-border/60 bg-background p-3">
          <ul className="space-y-1.5">
            {showAttendance ? (
              <GoalRow
                ok={attendanceOk}
                label={`Aulas ${vocabulary.inLevel}`}
                detail={`${presentSincePromotion}/${targetAttendances}${attendanceOk ? "" : ` · faltam ${targetAttendances - presentSincePromotion}`}`}
              />
            ) : null}
            {showTime ? (
              <GoalRow
                ok={timeOk}
                label={`Tempo ${vocabulary.inLevel}`}
                detail={`${monthsInLevel}/${targetMonths} ${targetMonths === 1 ? "mês" : "meses"}`}
              />
            ) : null}
            {stageGrades ? <StageGradeRows grades={stageGrades} inLevel={vocabulary.inLevel} /> : null}
          </ul>
          {!goalMet ? (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              Ainda não atingiu a meta. Dá para registrar mesmo assim, como num exame.
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="graduate-date" className="text-sm font-medium text-foreground">
            {vocabulary.promotionDate}
          </label>
          <Input
            id="graduate-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={date > todayISO() ? true : undefined}
            className="text-base md:text-sm"
          />
          {date > todayISO() ? (
            <p role="alert" className="text-xs text-destructive">
              A data não pode ser futura.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="graduate-examiner" className="text-sm font-medium text-foreground">
            Quem {isBelt ? "graduou" : "avaliou"} (opcional)
          </label>
          <Input
            id="graduate-examiner"
            value={examiner}
            onChange={(e) => setExaminer(e.target.value)}
            placeholder={`Informe o ${team.lower} ou a banca`}
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="graduate-notes" className="text-sm font-medium text-foreground">
          Observação (opcional)
        </label>
        <Textarea
          id="graduate-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informe como foi o exame ou a avaliação"
          className="text-base md:text-sm"
        />
      </div>

      </DialogBody>
      <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={isPending || !target || !date || date > todayISO() || unchanged}
          onClick={async () => {
            if (!target) return;
            // "Escolher outra" que volta ou pula niveis confirma antes (ALU-36).
            const targetIndex = track.levels.findIndex((l) => l.id === target.level.id);
            const goesBack =
              targetIndex < currentIndex || (targetIndex === currentIndex && target.sub < currentSubLevel);
            const skipped = targetIndex - currentIndex - 1;
            if (choice === "other" && (goesBack || skipped > 0)) {
              const ok = await confirm({
                title: goesBack ? `Voltar para ${target.level.name}?` : `Pular para ${target.level.name}?`,
                description: goesBack
                  ? `O aluno volta de ${levelWord}. Fica no histórico de graduações.`
                  : `Pula ${skipped === 1 ? `1 ${levelWord}` : `${skipped} ${vocabulary.levelPlural.toLowerCase()}`} da trilha.`,
                confirmLabel: "Confirmar",
                variant: "default",
              });
              if (!ok) return;
            }
            onConfirm({
              level: target.level,
              subLevel: target.sub,
              date,
              examiner: examiner.trim() || undefined,
              notes: notes.trim() || undefined,
            });
          }}
        >
          <Award className="size-4" />
          {isPending ? "Salvando..." : `Confirmar ${vocabulary.promotionLower}`}
        </Button>
      </DialogFooter>
      {confirmDialog}
    </>
  );
}
