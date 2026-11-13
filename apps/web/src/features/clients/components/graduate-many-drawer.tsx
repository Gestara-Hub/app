"use client";

import { useMemo, useState } from "react";
import { Award } from "lucide-react";
import type { Id, ModalityProgressionTrack, PromotionCandidate, ProgressionLevelStep } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { todayISO } from "@gestarahub/core/date";
import { plural } from "@gestarahub/core/format";
import { promotionReadiness } from "@gestarahub/core/progression";
import { BeltBadge } from "@/components/shared/belt-badge";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useModalityVocabulary, useTeamWords } from "@/features/settings";
import {
  ageAt,
  computeNextPromotionStep,
  nextLevelFor,
  resolveTrackStyle,
  trackUsesAges,
} from "@/lib/progression-tracks";
import { toast } from "@/lib/toast";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { cn } from "@/lib/utils";
import { usePromoteStudents, usePromotionCandidates } from "../hooks/use-clients";
import { levelOf, monthsSince } from "./progression-ui";

/**
 * "Graduar vários" (doc product/30 §3): os alunos escolhidos sobem juntos, com
 * a mesma data, quem graduou e a observação. Cada linha mostra o nivel de
 * hoje, o passo sugerido (grau ou proximo nivel, a mesma regra do Graduar) e
 * o "Apto" ou o que falta. Quem esta apto ja vem marcado; quem nao esta pode
 * entrar, e a confirmacao avisa (decisao 3 do doc 30).
 */

export interface GraduateManyStudent {
  id: Id;
  name: string;
}

interface GraduateManyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalityId: Id;
  students: GraduateManyStudent[];
  /** De onde veio a lista ("Turma Inglês A"), para o subtitulo. */
  contextLabel?: string;
  /** Evento de graduacao (doc product/30 §4): cada registro fica ligado a ele. */
  eventId?: Id;
  /** Data e examinador sugeridos (no evento: o dia e quem conduz). */
  defaultDate?: string;
  defaultExaminer?: string;
  /** Linha a mais por aluno (no evento: a situacao do pagamento) e se ainda deve. */
  extraOf?: (studentId: Id) => { text: string; tone: string; owes: boolean } | undefined;
  onDone?: () => void;
}

type Choice = "degree" | "level";

interface Option {
  choice: Choice;
  level: ProgressionLevelStep;
  sub: number;
}

/**
 * Passo de um aluno na trilha (mesmas regras do Graduar individual): nivel de
 * hoje, as opcoes (proximo grau e/ou proximo nivel, sem os de outra idade) e o
 * "Apto". Usado no "Graduar vários", na aba Graduação do evento e nos aptos do
 * Inscrever (doc product/30 §3 e §4).
 */
export function candidateStep(track: ModalityProgressionTrack, c: PromotionCandidate, onDate: string, inLevel?: string) {
  const age = trackUsesAges(track) ? ageAt(c.birthDate, onDate || todayISO()) : null;
  const current = levelOf(track, c.progression, age);
  const sub = c.progression?.subLevel ?? 0;
  const suggested = current ? computeNextPromotionStep(track, current.id, sub, age) : null;
  const options: Option[] = [];
  if (current && suggested && !suggested.isNewBelt) options.push({ choice: "degree", level: current, sub: sub + 1 });
  const next = nextLevelFor(track, current, age);
  if (next) options.push({ choice: "level", level: next, sub: 0 });
  const readiness = promotionReadiness({
    criteriaType: track.criteriaType ?? "attendance",
    targetAttendances: track.targetAttendances ?? 30,
    targetMonths: track.targetMonths ?? 6,
    presentSincePromotion: c.presentSincePromotion,
    monthsInLevel: monthsSince(c.progression?.promotedAt),
    hasNextStep: options.length > 0,
    grades: c.stageGrades,
    inLevel,
  });
  const defaultChoice: Choice = suggested?.isNewBelt || !options.some((o) => o.choice === "degree") ? "level" : "degree";
  return { current, sub, options, readiness, defaultChoice };
}

function GraduateManyForm({
  modalityId,
  students,
  contextLabel,
  eventId,
  defaultDate,
  defaultExaminer,
  extraOf,
  onClose,
  onDone,
}: Omit<GraduateManyDrawerProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const team = useTeamWords();
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const { data, isPending: loading, isError, error } = usePromotionCandidates(modalityId, ids);
  const promoteMut = usePromoteStudents();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  const track = data?.modality.progressionTrack;
  const style = resolveTrackStyle(track);
  const vocabulary = useModalityVocabulary(track);
  const isBelt = style === "belt";

  const [date, setDate] = useState(defaultDate && defaultDate <= todayISO() ? defaultDate : todayISO());
  const [examiner, setExaminer] = useState(defaultExaminer ?? "");
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<Set<Id> | null>(null);
  const [choices, setChoices] = useState<Record<Id, Choice>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data || !track?.enabled) return [];
    return data.candidates.map((c) => ({ candidate: c, ...candidateStep(track, c, date, vocabulary.inLevel) }));
  }, [data, track, date, vocabulary.inLevel]);

  // Quem esta apto ja vem marcado; depois vale o que a pessoa marcar.
  const selected = checked ?? new Set(rows.filter((r) => r.readiness.ready).map((r) => r.candidate.studentId));
  const toggle = (id: Id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    setSubmitError(null);
  };
  const picked = rows.filter((r) => selected.has(r.candidate.studentId) && r.options.length > 0);
  const optionOf = (row: (typeof rows)[number]) => {
    const choice = choices[row.candidate.studentId] ?? row.defaultChoice;
    return row.options.find((o) => o.choice === choice) ?? row.options[0];
  };

  const futureDate = Boolean(date) && date > todayISO();
  const isPending = promoteMut.isPending;

  const submit = async () => {
    if (picked.length === 0) {
      setSubmitError("Marque ao menos um aluno.");
      return;
    }
    if (!date || futureDate) return;
    const notReady = picked.filter((r) => !r.readiness.ready).length;
    // No evento: quem ainda deve entra, mas a confirmacao avisa (doc product/30 §4).
    const owing = picked.filter((r) => extraOf?.(r.candidate.studentId)?.owes).length;
    const warnings = [
      notReady > 0 ? `${plural(notReady, "aluno ainda não está apto", "alunos ainda não estão aptos")}.` : "",
      owing > 0 ? `${plural(owing, "aluno ainda deve", "alunos ainda devem")} o evento.` : "",
    ].filter(Boolean);
    const ok = await confirm({
      title: `${vocabulary.promoteVerb} ${plural(picked.length, "aluno", "alunos")}?`,
      description:
        warnings.length > 0
          ? `${warnings.join(" ")} Fica registrado no histórico como os outros.`
          : "Cada aluno ganha o registro no histórico.",
      confirmLabel: vocabulary.promoteVerb,
      variant: "default",
    });
    if (!ok) return;
    try {
      const result = await promoteMut.mutateAsync({
        modalityId,
        ...(eventId ? { eventId } : {}),
        date,
        examiner: examiner.trim() || undefined,
        notes: notes.trim() || undefined,
        items: picked.map((r) => {
          const option = optionOf(r);
          return { studentId: r.candidate.studentId, toLevelId: option.level.id, toSubLevel: option.sub };
        }),
      });
      toast.success(`Registrado para ${plural(result.promoted, "aluno", "alunos")}.`);
      onDone?.();
      onClose();
    } catch (err) {
      const message = getErrorMessage(err, "Não foi possível registrar.");
      setSubmitError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
        <SheetTitle className="text-lg font-semibold text-foreground">{vocabulary.promoteVerb} alunos</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          {contextLabel ? `${contextLabel}. ` : ""}Quem está apto já vem marcado.
        </SheetDescription>
      </SheetHeader>

      <DialogBody className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            {students.map((s) => (
              <Skeleton key={s.id} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(error, "Não foi possível carregar os alunos.")}
          </p>
        ) : !track?.enabled ? (
          <p className="text-sm text-muted-foreground">Esta modalidade não tem trilha de níveis.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border">
            {rows.map((row) => {
              const id = row.candidate.studentId;
              const option = row.options.length > 0 ? optionOf(row) : undefined;
              const isChecked = selected.has(id) && Boolean(option);
              return (
                <li key={id} className="flex items-start gap-3 px-3 py-2.5">
                  <Checkbox
                    id={`graduate-many-${id}`}
                    checked={isChecked}
                    disabled={!option || isPending}
                    onCheckedChange={() => toggle(id)}
                    className="mt-0.5"
                    aria-label={`Incluir ${row.candidate.studentName}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label htmlFor={`graduate-many-${id}`} className="block min-w-0 break-words text-sm font-medium text-foreground">
                      {row.candidate.studentName}
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.current ? (
                        <BeltBadge
                          name={row.current.name}
                          color={row.current.color}
                          variant={style}
                          subLevel={row.sub}
                          maxSubLevels={row.current.maxSubLevels}
                          size="xs"
                        />
                      ) : null}
                      {option ? (
                        <>
                          <span aria-hidden className="text-xs text-muted-foreground">→</span>
                          {row.options.length > 1 ? (
                            <Select
                              value={option.choice}
                              onValueChange={(value) => setChoices((prev) => ({ ...prev, [id]: value as Choice }))}
                              disabled={isPending}
                            >
                              <SelectTrigger className="w-auto min-w-36" aria-label={`Para onde ${row.candidate.studentName} vai`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {row.options.map((o) => (
                                  <SelectItem key={o.choice} value={o.choice}>
                                    {o.choice === "degree" ? `${o.sub}º grau` : o.level.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <BeltBadge
                              name={option.level.name}
                              color={option.level.color}
                              variant={style}
                              subLevel={option.sub}
                              maxSubLevels={option.level.maxSubLevels}
                              size="xs"
                            />
                          )}
                        </>
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        "min-w-0 break-words text-xs",
                        !option
                          ? "text-muted-foreground"
                          : row.readiness.ready
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {!option
                        ? "Último nível da trilha"
                        : row.readiness.ready
                          ? vocabulary.readyBadge
                          : row.readiness.gaps.length > 0
                            ? row.readiness.gaps.join(" · ")
                            : "Por avaliação do professor"}
                    </p>
                    {(() => {
                      const extra = extraOf?.(id);
                      return extra ? <p className={cn("text-xs", extra.tone)}>{extra.text}</p> : null;
                    })()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="graduate-many-date" className="text-sm font-medium text-foreground">
              {vocabulary.promotionDate}
            </label>
            <Input
              id="graduate-many-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={futureDate ? true : undefined}
              className="text-base md:text-sm"
            />
            {futureDate ? (
              <p role="alert" className="text-xs text-destructive">
                A data não pode ser futura.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="graduate-many-examiner" className="text-sm font-medium text-foreground">
              Quem {isBelt ? "graduou" : "avaliou"} (opcional)
            </label>
            <Input
              id="graduate-many-examiner"
              value={examiner}
              onChange={(e) => setExaminer(e.target.value)}
              placeholder={`Informe o ${team.lower} ou a banca`}
              className="text-base md:text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="graduate-many-notes" className="text-sm font-medium text-foreground">
            Observação (opcional)
          </label>
          <Textarea
            id="graduate-many-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informe como foi o exame ou a avaliação"
            className="text-base md:text-sm"
          />
        </div>
      </DialogBody>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/40 bg-background p-6 pt-4 sm:flex sm:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancelar
          </Button>
        </SheetClose>
        <Button type="button" onClick={submit} disabled={isPending || loading || !track?.enabled || futureDate}>
          <Award className="size-4" />
          {isPending
            ? "Salvando..."
            : picked.length > 0
              ? `${vocabulary.promoteVerb} ${plural(picked.length, "aluno", "alunos")}`
              : vocabulary.promoteVerb}
        </Button>
      </div>
      {confirmDialog}
    </>
  );
}

export function GraduateManyDrawer({ open, onOpenChange, students, ...rest }: GraduateManyDrawerProps) {
  const present = useDialogPresence(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {present && students.length > 0 ? (
          <GraduateManyForm
            key={students.map((s) => s.id).join(",")}
            {...rest}
            students={students}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
