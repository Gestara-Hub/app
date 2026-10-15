"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type {
  AssessmentGradeInput,
  AssessmentGradeStatus,
  AssessmentSheet,
  AssessmentSheetRow,
  Id,
} from "@gestarahub/contracts";
import {
  CONCEPT_GRADES,
  averageGrades,
  formatAverage,
  formatGrade,
  isBelowPassing,
  normalizeGrade,
} from "@gestarahub/core/grades";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { DialogFormFooter } from "@/components/form";
import { InitialsAvatar } from "@/components/shared/list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAssessmentSheet, useSetGrades } from "../hooks/use-grades";
import { passingLabel } from "./grade-ui";

/** Rascunho de uma linha: `raw` e o texto digitado ou a letra/apto escolhido. */
interface Draft {
  status: AssessmentGradeStatus;
  raw: string;
}

function draftOf(row: AssessmentSheetRow, scale: AssessmentSheet["settings"]["scale"]): Draft {
  if (row.status !== "graded" || row.value === undefined) return { status: row.status, raw: "" };
  return { status: "graded", raw: typeof row.value === "number" ? formatGrade(scale, row.value) : String(row.value) };
}

const chip =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors disabled:opacity-50";
const chipOff = "border-border/70 text-muted-foreground hover:bg-accent/50";
const chipOn = "border-foreground/40 bg-foreground/5 text-foreground";
const chipBelow = "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400";

function SheetForm({ sheet, onDone }: { sheet: AssessmentSheet; onDone: () => void }) {
  const { settings, rows } = sheet;
  const { scale } = settings;
  const setGradesMut = useSetGrades();
  const pending = setGradesMut.isPending;
  const initial = useMemo(() => new Map(rows.map((r) => [r.studentId, draftOf(r, scale)])), [rows, scale]);
  const [drafts, setDrafts] = useState<Map<Id, Draft>>(initial);
  const [errors, setErrors] = useState<Map<Id, string>>(new Map());

  const update = (studentId: Id, next: Draft) => {
    setDrafts((prev) => new Map(prev).set(studentId, next));
    setErrors((prev) => {
      if (!prev.has(studentId)) return prev;
      const copy = new Map(prev);
      copy.delete(studentId);
      return copy;
    });
  };

  const checks = useMemo(() => {
    const out = new Map<Id, ReturnType<typeof normalizeGrade>>();
    for (const [id, d] of drafts) {
      if (d.status === "graded" && d.raw.trim() !== "") out.set(id, normalizeGrade(scale, d.raw));
    }
    return out;
  }, [drafts, scale]);

  // Media ao vivo: so as notas validas digitadas (faltou e sem nota ficam fora).
  const liveAverage = useMemo(
    () =>
      averageGrades(
        settings,
        [...checks.values()].flatMap((c) => (c.ok ? [{ status: "graded" as const, value: c.value, weight: 1 }] : [])),
      ),
    [checks, settings],
  );
  const filled = [...drafts.values()].filter((d) => d.status === "absent" || (d.status === "graded" && d.raw.trim() !== "")).length;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = new Map<Id, string>();
    const changed: AssessmentGradeInput[] = [];
    for (const row of rows) {
      const d = drafts.get(row.studentId) ?? { status: "none", raw: "" };
      const before = initial.get(row.studentId);
      if (before && before.status === d.status && before.raw === d.raw) continue;
      if (d.status === "graded" && d.raw.trim() === "") {
        changed.push({ studentId: row.studentId, status: "none" });
        continue;
      }
      if (d.status === "graded") {
        const check = normalizeGrade(scale, d.raw);
        if (!check.ok) {
          nextErrors.set(row.studentId, check.message);
          continue;
        }
        changed.push({ studentId: row.studentId, status: "graded", value: check.value });
      } else {
        changed.push({ studentId: row.studentId, status: d.status });
      }
    }
    if (nextErrors.size > 0) {
      setErrors(nextErrors);
      toast.error("Confira as notas destacadas.");
      return;
    }
    if (changed.length === 0) {
      onDone();
      return;
    }
    try {
      await setGradesMut.mutateAsync({ assessmentId: sheet.assessment.id, grades: changed });
      toast.success("Notas salvas.");
      onDone();
    } catch (error) {
      const fields = getFieldErrors(error) ?? [];
      if (fields.length > 0) {
        setErrors(new Map(fields.map((f) => [f.field.replace(/^grades\./, ""), f.message])));
        toast.error("Confira as notas destacadas.");
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar as notas."));
      }
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/40 px-6 py-2 text-xs text-muted-foreground">
        <span>
          Lançadas {filled} de {rows.length} · {passingLabel(settings)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          Média
          <span
            className={cn(
              "font-semibold tabular-nums text-foreground",
              liveAverage?.belowPassing && "text-red-600 dark:text-red-400",
            )}
          >
            {liveAverage ? formatAverage(scale, liveAverage) : "–"}
          </span>
        </span>
      </div>
      <DialogBody className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum aluno matriculado nesta turma.
          </p>
        ) : (
          rows.map((row) => {
            const d = drafts.get(row.studentId) ?? { status: "none", raw: "" };
            const check = checks.get(row.studentId);
            const below =
              d.status === "graded" && check?.ok ? isBelowPassing(scale, check.value, settings.passingGrade) : false;
            const error = errors.get(row.studentId) ?? (check && !check.ok ? check.message : undefined);
            const inputId = `grade-${row.studentId}`;
            const isNumeric = scale === "zero_ten" || scale === "zero_hundred";
            return (
              <div
                key={row.studentId}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  below ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20" : "border-border/70",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar name={row.studentName} />
                    {/* So o campo de nota leva o rotulo: nos botoes (conceito, apto) o nome de cada
                        opcao e a propria letra; o grupo ja se chama "Conceito de {aluno}". */}
                    <label htmlFor={isNumeric ? inputId : undefined} className="text-sm font-medium">
                      {row.studentName}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isNumeric ? (
                      <Input
                        id={inputId}
                        inputMode={scale === "zero_ten" ? "decimal" : "numeric"}
                        autoComplete="off"
                        placeholder="Nota"
                        value={d.status === "graded" ? d.raw : ""}
                        disabled={pending}
                        onChange={(e) => update(row.studentId, { status: "graded", raw: e.target.value })}
                        aria-invalid={error ? true : undefined}
                        className={cn(
                          "h-9 w-20 text-center text-base tabular-nums md:text-sm",
                          below && "border-red-300 text-red-700 dark:text-red-400",
                        )}
                      />
                    ) : scale === "concept" ? (
                      <div role="radiogroup" aria-label={`Conceito de ${row.studentName}`} className="flex gap-1">
                        {CONCEPT_GRADES.map((letter) => {
                          const on = d.status === "graded" && d.raw === letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={pending}
                              onClick={() =>
                                update(row.studentId, on ? { status: "none", raw: "" } : { status: "graded", raw: letter })
                              }
                              className={cn(chip, on ? (below ? chipBelow : chipOn) : chipOff)}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div role="radiogroup" aria-label={`Resultado de ${row.studentName}`} className="flex gap-1">
                        {(["pass", "fail"] as const).map((value) => {
                          const on = d.status === "graded" && d.raw === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={pending}
                              onClick={() =>
                                update(row.studentId, on ? { status: "none", raw: "" } : { status: "graded", raw: value })
                              }
                              className={cn(chip, on ? (value === "fail" ? chipBelow : chipOn) : chipOff)}
                            >
                              {formatGrade("pass_fail", value)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-pressed={d.status === "absent"}
                      disabled={pending}
                      onClick={() =>
                        update(row.studentId, d.status === "absent" ? { status: "none", raw: "" } : { status: "absent", raw: "" })
                      }
                      className={cn(
                        chip,
                        d.status === "absent"
                          ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          : chipOff,
                      )}
                    >
                      Faltou
                    </button>
                    <button
                      type="button"
                      aria-pressed={d.status === "none" || (d.status === "graded" && d.raw.trim() === "")}
                      disabled={pending}
                      onClick={() => update(row.studentId, { status: "none", raw: "" })}
                      className={cn(
                        chip,
                        d.status === "none" || (d.status === "graded" && d.raw.trim() === "") ? chipOn : chipOff,
                      )}
                    >
                      Sem nota
                    </button>
                  </div>
                </div>
                {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
              </div>
            );
          })
        )}
      </DialogBody>
      <DialogFormFooter isPending={pending} isEdit className="shrink-0 border-t border-border/40 bg-background p-6 pt-4" />
    </form>
  );
}

/** "Lançar notas": uma linha por aluno matriculado, pensado para o celular. */
export function GradeEntryDialog({
  assessmentId,
  onOpenChange,
}: {
  assessmentId: Id | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(assessmentId);
  const { data: sheet, isPending } = useAssessmentSheet(assessmentId ?? undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        expandable
        storageKey="grade-entry"
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 p-6 pb-3 pr-20">
          <DialogTitle>Lançar notas</DialogTitle>
          <DialogDescription>
            {sheet ? `${sheet.assessment.name} · ${sheet.classGroupName}` : "Carregando a avaliação"}
          </DialogDescription>
        </DialogHeader>
        {open && sheet && !isPending ? (
          <SheetForm key={sheet.assessment.id} sheet={sheet} onDone={() => onOpenChange(false)} />
        ) : open ? (
          <div className="space-y-2 px-6 pb-6">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
