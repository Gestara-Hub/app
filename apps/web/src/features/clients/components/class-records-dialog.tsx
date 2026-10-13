"use client";

import { useState } from "react";
import { FileText, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import type { Client, DateISO, EvaluationEntryTone, Id } from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import { relativeDateLabel, todayISO } from "@gestarahub/core/date";
import { InitialsAvatar } from "@/components/shared/list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [classNote, setClassNote] = useState("");
  const [tones, setTones] = useState<Record<string, EvaluationEntryTone | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
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
            placeholder="Informe o que foi treinado hoje (opcional)"
            className="text-base md:text-sm"
          />
          <p className="text-xs text-muted-foreground">Com anotação, entra no registro de todos os presentes.</p>
        </div>

        <TooltipProvider delayDuration={200}>
          <ul className="divide-y rounded-xl border" aria-label="Presentes">
            {students.map((s) => {
              const reminder = nextClassReminder(s.progressions?.[session.modalityId], session.date);
              const hasNote = Boolean(notes[s.id]?.trim());
              return (
                <li key={s.id} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
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
                      placeholder={`Anotação sobre ${s.name.split(" ")[0]} (opcional)`}
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/40 px-6 py-4">
        <span className="text-xs text-muted-foreground">
          {total > 0 ? `${plural(total, "aluno", "alunos")} com registro` : "Marque só quem se destacou."}
        </span>
        <div className="flex gap-2">
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
  session,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassRecordsSession | null;
  students: Client[];
}) {
  const when = session ? (session.date === todayISO() ? "hoje" : relativeDateLabel(session.date)) : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
          <DialogTitle>Registrar a aula</DialogTitle>
          <DialogDescription>
            {session ? `${session.classGroupName} · ${when} · ${plural(students.length, "presente", "presentes")}` : ""}
          </DialogDescription>
        </DialogHeader>
        {open && session ? (
          <ClassRecordsForm session={session} students={students} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
