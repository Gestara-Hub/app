"use client";

import { useRetainedValue } from "@/lib/use-retained-value";
import { useDialogPresence } from "@/lib/use-dialog-presence";
import { useState } from "react";
import { FileText, NotebookPen } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Client, DateISO, EvaluationEntryTone, Id } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import { todayISO } from "@gestarahub/core/date";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  useReportDialogSaving,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAddClassRecords } from "../hooks/use-clients";
import { TONES, TONE_META, nextClassReminder } from "./progression-ui";

export interface ClassRecordsSession {
  sessionId: Id;
  date: DateISO;
  classGroupId: Id;
  classGroupName: string;
  modalityId: Id;
  /** Dias da semana da turma (lembrete "Para hoje" so na 1a aula depois do registro). */
  weekdays?: number[];
}

function ClassRecordsForm({
  session,
  students,
  onDone,
}: {
  session: ClassRecordsSession;
  students: Client[];
  onDone: () => void;
}) {
  const addMut = useAddClassRecords();
  useReportDialogSaving(addMut.isPending);
  // Aula ja registrada: abre com o que foi salvo (salvar de novo troca, nao duplica).
  const existing = (s: Client) =>
    s.progressions?.[session.modalityId]?.evaluations.find((e) => e.sessionId === session.sessionId);
  const [classNote, setClassNote] = useState(
    () => students.map((s) => existing(s)?.classNote).find(Boolean) ?? "",
  );
  const [tones, setTones] = useState<Record<string, EvaluationEntryTone | undefined>>(() =>
    Object.fromEntries(students.map((s) => [s.id, existing(s)?.tone])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, existing(s)?.note ?? ""])),
  );
  const [openNote, setOpenNote] = useState<string | null>(null);

  const marked = students.filter((s) => tones[s.id] || notes[s.id]?.trim()).length;
  const total = classNote.trim() ? students.length : marked;

  async function save() {
    try {
      const created = await addMut.mutateAsync({
        ...session,
        classNote,
        entries: students.map((s) => ({ studentId: s.id, tone: tones[s.id], note: notes[s.id] })),
      });
      toast.success(`${plural(created, "registro salvo", "registros salvos")}.`);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar os registros."));
    }
  }

  return (
    <>
      <DialogBody className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="class-note" className="text-sm font-medium text-foreground">
            Anotação da turma
          </label>
          <Input
            id="class-note"
            value={classNote}
            onChange={(e) => setClassNote(e.target.value)}
            placeholder="O que foi treinado"
            className="text-base md:text-sm"
          />
          <p className="text-xs text-muted-foreground">Com anotação, entra no registro de todos os presentes.</p>
        </div>

        {/* Legenda dos tons: no celular nao ha tooltip e as bolinhas ficavam sem nome. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          {TONES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", TONE_META[t].dot)} />
              {TONE_META[t].label}
            </span>
          ))}
        </p>

        <TooltipProvider delayDuration={200}>
          <ul className="divide-y rounded-xl border" aria-label="Presentes">
            {students.map((s) => {
              const reminder = nextClassReminder(s.progressions?.[session.modalityId], session.date, session);
              const hasNote = Boolean(notes[s.id]?.trim());
              return (
                <li key={s.id} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="max-sm:hidden">
                      <InitialsAvatar name={s.name} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 break-words text-sm font-medium text-foreground">{s.name}</p>
                      {reminder ? (
                        <p className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <NotebookPen className="size-3 shrink-0" />
                          Para hoje: {reminder}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {TONES.map((t) => (
                        <Tooltip key={t}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${TONE_META[t].label}: ${s.name}`}
                              aria-pressed={tones[s.id] === t}
                              onClick={() => setTones((prev) => ({ ...prev, [s.id]: prev[s.id] === t ? undefined : t }))}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-md border transition-colors",
                                tones[s.id] === t ? TONE_META[t].className : "text-muted-foreground hover:bg-accent/50",
                              )}
                            >
                              <span className={cn("size-2.5 rounded-full", TONE_META[t].dot)} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{TONE_META[t].label}</TooltipContent>
                        </Tooltip>
                      ))}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Anotar sobre ${s.name}`}
                            aria-expanded={openNote === s.id}
                            onClick={() => setOpenNote((v) => (v === s.id ? null : s.id))}
                            className={cn(
                              "flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent/50",
                              hasNote && "border-primary/40 text-primary",
                            )}
                          >
                            <FileText className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Anotar</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {openNote === s.id ? (
                    <Input
                      value={notes[s.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder={`Anotação sobre ${s.name.split(" ")[0]}`}
                      className="text-base md:text-sm"
                      aria-label={`Anotação sobre ${s.name}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </DialogBody>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <span className="text-xs text-muted-foreground">
          {total > 0 ? `${plural(total, "aluno", "alunos")} com registro` : "Marque só quem se destacou."}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="outline" onClick={onDone} disabled={addMut.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={total === 0 || addMut.isPending}>
            {addMut.isPending ? "Salvando..." : "Salvar registros"}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Registro da turma inteira pela chamada: os presentes numa lista, um toque no
 * tom de quem se destacou e anotacao so para quem precisar. Cada marcacao vira
 * um registro na ficha do aluno ("Registros de aula").
 */
export function ClassRecordsDialog({
  open,
  onOpenChange,
  session: sessionProp,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassRecordsSession | null;
  students: Client[];
}) {
  const session = useRetainedValue(sessionProp);
  const present = useDialogPresence(open);
  const when = session
    ? session.date === todayISO()
      ? "hoje"
      : `${session.date.slice(8, 10)}/${session.date.slice(5, 7)}`
    : "";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 overflow-hidden shadow-2xl flex flex-col h-full border-l border-border/60"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-16 text-left">
          <SheetTitle className="text-lg font-semibold text-foreground">Registrar a aula</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {session ? `${session.classGroupName} · ${when} · ${plural(students.length, "presente", "presentes")}` : ""}
          </SheetDescription>
        </SheetHeader>
        {present && session ? (
          <ClassRecordsForm session={session} students={students} onDone={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
