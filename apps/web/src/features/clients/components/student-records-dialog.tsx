"use client";

import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, CheckCircle2, MessageSquarePlus, NotebookPen, RotateCcw, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  Client,
  DateISO,
  EvaluationEntryTone,
  Id,
  StudentEvaluationEntry,
  StudentGoal,
} from "@gestarahub/contracts";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { relativeDateLabel, todayISO } from "@gestarahub/core/date";
import { DialogFormFooter, InputNumber, InputText } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { handleFormApiError } from "@/lib/form-errors";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  useAddClassRecord,
  useAddGoal,
  useProgressionTermSuggestions,
  useRemoveGoal,
  useSetGoalCompleted,
  useUpdateStrengths,
} from "../hooks/use-clients";
import { ProgressionTermsEditor } from "./progression-terms-editor";
import { ModalityPicker, TONES, TONE_META, nextClassReminder, useStudentModalities } from "./progression-ui";

/** De qual aula e o registro (vindo da chamada) ou so a data (hoje). */
export interface ClassRecordContext {
  date: DateISO;
  sessionId?: Id;
  classGroupId?: Id;
  classGroupName?: string;
  modalityId?: Id;
}

const PAGE_SIZE = 10;

function goalDone(g: StudentGoal): boolean {
  return Boolean(g.completedAt) || (g.target !== undefined && g.progress >= g.target);
}

// --- Metas ------------------------------------------------------------------

function GoalPill({
  goal,
  disabled,
  onToggle,
  onRemove,
}: {
  goal: StudentGoal;
  disabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const done = goalDone(goal);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent/50",
            done
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/5 text-foreground",
          )}
        >
          {done ? <CheckCircle2 className="size-3" /> : <Target className="size-3 text-amber-500" />}
          {goal.title}
          {goal.target ? (
            <span className="tabular-nums text-muted-foreground">
              {Math.min(goal.progress, goal.target)}/{goal.target}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuItem onSelect={onToggle}>
          {done ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
          {done ? "Reabrir meta" : "Marcar como feita"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 className="size-4" />
          Remover meta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const goalSchema = z.object({
  title: z.string().trim().min(1, "Informe a meta.").max(80, "Use no máximo 80 caracteres."),
  target: z
    .number({ error: "Informe uma quantidade válida." })
    .int("Informe uma quantidade inteira.")
    .min(1, "Informe uma quantidade maior que zero.")
    .nullable()
    .optional(),
});
type GoalFormValues = z.infer<typeof goalSchema>;

function NewGoalForm({
  studentId,
  modalityId,
  suggestions,
  onDone,
}: {
  studentId: Id;
  modalityId: Id;
  suggestions: string[];
  onDone: () => void;
}) {
  const addMut = useAddGoal();
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { title: "", target: null },
  });
  const title = useWatch({ control: form.control, name: "title" });
  const query = normalizeText(title ?? "");
  const chips = suggestions.filter((s) => !query || normalizeText(s).includes(query)).slice(0, 6);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await addMut.mutateAsync({
        studentId,
        modalityId,
        title: values.title,
        ...(values.target ? { target: values.target } : {}),
      });
      toast.success("Meta adicionada.");
      onDone();
    } catch (error) {
      handleFormApiError(error, form, "Não foi possível adicionar a meta.");
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <InputText<GoalFormValues>
              name="title"
              label="Meta"
              placeholder="Informe o que o aluno deve treinar"
              required
              disabled={addMut.isPending}
            />
            {chips.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {chips.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => form.setValue("title", s, { shouldDirty: true, shouldValidate: true })}
                    className="rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <InputNumber<GoalFormValues>
            name="target"
            label="Quantidade (opcional)"
            placeholder="Sem número"
            min={1}
            hint="Com quantidade, o avanço é marcado ao registrar a aula. Sem, é só marcar como feita."
            disabled={addMut.isPending}
          />
        </DialogBody>
        <DialogFormFooter isPending={addMut.isPending} className="shrink-0 border-t border-border/40 px-6 py-4" />
      </form>
    </FormProvider>
  );
}

// --- Registro da aula -------------------------------------------------------

function Composer({
  studentId,
  modalityId,
  context,
  goals,
}: {
  studentId: Id;
  modalityId: Id;
  context: ClassRecordContext;
  goals: StudentGoal[];
}) {
  const addMut = useAddClassRecord();
  const [tone, setTone] = useState<EvaluationEntryTone>("positive");
  const [note, setNote] = useState("");
  const [nextClass, setNextClass] = useState("");
  const [more, setMore] = useState(false);
  const [increments, setIncrements] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const openGoals = goals.filter((g) => !goalDone(g));
  const hasGoalProgress = Object.values(increments).some((n) => n > 0) || completed.length > 0;
  const canSave = Boolean(note.trim() || nextClass.trim() || hasGoalProgress);

  const isToday = context.date === todayISO();
  const label = context.classGroupName
    ? `${isToday ? "Aula de hoje" : `Aula de ${relativeDateLabel(context.date)}`} · ${context.classGroupName}`
    : "Registro de hoje";

  async function save() {
    try {
      await addMut.mutateAsync({
        studentId,
        modalityId,
        date: context.date,
        sessionId: context.sessionId,
        classGroupId: context.classGroupId,
        classGroupName: context.classGroupName,
        tone,
        note,
        nextClassNote: nextClass,
        goalProgress: [
          ...Object.entries(increments)
            .filter(([, n]) => n > 0)
            .map(([goalId, amount]) => ({ goalId, amount })),
          ...completed.map((goalId) => ({ goalId, completed: true })),
        ],
      });
      toast.success("Aula registrada.");
      setNote("");
      setNextClass("");
      setIncrements({});
      setCompleted([]);
      setMore(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível registrar a aula."));
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Como foi">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tone === t}
              onClick={() => setTone(t)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                tone === t ? TONE_META[t].className : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {TONE_META[t].label}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Como o aluno foi nesta aula?"
        className="text-base md:text-sm"
        aria-label="Anotação da aula"
      />
      {more ? (
        <div className="space-y-2.5">
          {openGoals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {openGoals.map((g) =>
                g.target ? (
                  <span key={g.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                    {g.title}
                    <span className="tabular-nums text-muted-foreground">
                      {Math.min(g.progress + (increments[g.id] ?? 0), g.target)}/{g.target}
                    </span>
                    {[1, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Somar ${n} em ${g.title}`}
                        onClick={() => setIncrements((prev) => ({ ...prev, [g.id]: (prev[g.id] ?? 0) + n }))}
                        className="rounded border px-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        +{n}
                      </button>
                    ))}
                  </span>
                ) : (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={completed.includes(g.id)}
                    onClick={() =>
                      setCompleted((prev) => (prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      completed.includes(g.id)
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Check className="size-3" />
                    {g.title}
                  </button>
                ),
              )}
            </div>
          ) : null}
          <Input
            value={nextClass}
            onChange={(e) => setNextClass(e.target.value)}
            placeholder="Para a próxima aula (opcional)"
            className="text-base md:text-sm"
            aria-label="Para a próxima aula"
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMore((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
          {more ? "Menos opções" : openGoals.length > 0 ? "+ Metas e próxima aula" : "+ Próxima aula"}
        </button>
        <Button type="button" size="sm" disabled={!canSave || addMut.isPending} onClick={() => void save()}>
          {addMut.isPending ? "Salvando..." : "Registrar"}
        </Button>
      </div>
    </div>
  );
}

function RecordItem({ record }: { record: StudentEvaluationEntry }) {
  const goalNotes = (record.goalProgress ?? []).map((g) =>
    g.amount ? `${g.title} +${g.amount}${g.completed ? " (feita)" : ""}` : `${g.title} feita`,
  );
  return (
    <li className="relative flex gap-3 pl-1">
      <span className={cn("z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-background", TONE_META[record.tone].dot)} />
      <div className="min-w-0 flex-1 space-y-1 pb-1 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-foreground">
            {TONE_META[record.tone].label}
            {record.classGroupName ? <span className="font-normal text-muted-foreground"> · {record.classGroupName}</span> : null}
          </span>
          <span className="text-muted-foreground">
            {relativeDateLabel(record.date)}
            {record.authorName ? ` · ${record.authorName}` : ""}
          </span>
        </div>
        {record.classNote ? <p className="text-[11px] text-muted-foreground">Turma: {record.classNote}</p> : null}
        {record.note ? <p className="text-foreground/90">{record.note}</p> : null}
        {goalNotes.length > 0 ? <p className="text-[11px] text-muted-foreground">{goalNotes.join(" · ")}</p> : null}
        {record.nextClassNote ? (
          <p className="inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300">
            Para a próxima aula: {record.nextClassNote}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function RecordsContent({ client, context }: { client: Client; context: ClassRecordContext }) {
  const { isPending, items, active, select } = useStudentModalities(client.id, context.modalityId);
  const modalityId = active?.modality.id;
  const { data: suggestions } = useProgressionTermSuggestions(modalityId);
  const strengthsMut = useUpdateStrengths();
  const goalDoneMut = useSetGoalCompleted();
  const removeGoalMut = useRemoveGoal();
  const [goalOpen, setGoalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const progression = active?.progression;
  const strengths = progression?.strengths ?? [];
  const goals = [...(progression?.goals ?? [])].sort((a, b) => Number(goalDone(a)) - Number(goalDone(b)));
  const records = [...(progression?.evaluations ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const reminder = nextClassReminder(progression, context.date);
  const goalKeys = new Set(goals.map((g) => normalizeText(g.title)));
  const goalSuggestions = (suggestions?.goals ?? []).filter((t) => !goalKeys.has(normalizeText(t)));
  // A aula da chamada so vale para a propria modalidade.
  const recordContext: ClassRecordContext =
    context.modalityId && context.modalityId !== modalityId ? { date: todayISO() } : context;

  function saveStrengths(next: string[]) {
    if (!modalityId) return;
    strengthsMut.mutate(
      { studentId: client.id, modalityId, strengths: next },
      { onError: (err) => toast.error(getErrorMessage(err, "Não foi possível salvar os pontos fortes.")) },
    );
  }

  return (
    <DialogContent expandable className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-20 text-left">
        <DialogTitle className="flex items-center gap-2">
          <MessageSquarePlus className="size-5 text-primary" />
          Registros de aula
        </DialogTitle>
        <DialogDescription>
          {client.name}
          {active ? ` · ${active.modality.name}` : ""}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-4">
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 rounded-full" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : !active || !modalityId ? (
          <div className="space-y-2 rounded-xl border border-dashed p-8 text-center">
            <MessageSquarePlus className="mx-auto size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Nenhuma turma com trilha ativa</p>
            <p className="mx-auto max-w-md text-xs text-muted-foreground">
              Os registros de aula ficam por modalidade. Matricule o aluno numa turma com trilha ligada.
            </p>
          </div>
        ) : (
          <>
            <ModalityPicker
              items={items}
              activeId={modalityId}
              onSelect={(id) => {
                select(id);
                setVisibleCount(PAGE_SIZE);
              }}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Metas</p>
                <button type="button" onClick={() => setGoalOpen(true)} className="text-xs font-medium text-primary hover:underline">
                  + Nova meta
                </button>
              </div>
              {goals.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {goals.map((g) => (
                    <GoalPill
                      key={g.id}
                      goal={g}
                      disabled={goalDoneMut.isPending || removeGoalMut.isPending}
                      onToggle={() =>
                        goalDoneMut.mutate(
                          { studentId: client.id, modalityId, goalId: g.id, completed: !goalDone(g) },
                          { onError: (err) => toast.error(getErrorMessage(err, "Não foi possível atualizar a meta.")) },
                        )
                      }
                      onRemove={() =>
                        removeGoalMut.mutate(
                          { studentId: client.id, modalityId, goalId: g.id },
                          {
                            onSuccess: () => toast.success("Meta removida."),
                            onError: (err) => toast.error(getErrorMessage(err, "Não foi possível remover a meta.")),
                          },
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma meta. Crie uma para acompanhar o treino.</p>
              )}
            </div>

            <ProgressionTermsEditor
              key={`strengths-${modalityId}`}
              title="Pontos fortes"
              placeholder="Informe um ponto forte"
              items={strengths}
              suggestions={suggestions?.strengths ?? []}
              disabled={strengthsMut.isPending}
              onAdd={(term) => saveStrengths([...strengths, term])}
              onRemove={(term) => saveStrengths(strengths.filter((t) => t !== term))}
            />

            <div className="space-y-2">
              {reminder ? (
                <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
                  <NotebookPen className="size-3" />
                  Para hoje: {reminder}
                </p>
              ) : null}
              <Composer
                key={`composer-${modalityId}`}
                studentId={client.id}
                modalityId={modalityId}
                context={recordContext}
                goals={goals}
              />
            </div>

            {records.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Aulas registradas ({records.length})
                </p>
                <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border">
                  {records.slice(0, visibleCount).map((r) => (
                    <RecordItem key={r.id} record={r} />
                  ))}
                </ol>
                {records.length > visibleCount ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Mostrar mais ({records.length - visibleCount})
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
              <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4 pr-14">
                  <DialogTitle>Nova meta</DialogTitle>
                  <DialogDescription>
                    {client.name} · {active.modality.name}
                  </DialogDescription>
                </DialogHeader>
                {goalOpen ? (
                  <NewGoalForm
                    studentId={client.id}
                    modalityId={modalityId}
                    suggestions={goalSuggestions}
                    onDone={() => setGoalOpen(false)}
                  />
                ) : null}
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogBody>
    </DialogContent>
  );
}

/**
 * Modal de Registros de aula (toda aula): metas, pontos fortes, caixa de
 * registro e a linha do tempo. Aberto pela chamada, ja vem com a aula.
 */
export function StudentRecordsDialog({
  client,
  open,
  onOpenChange,
  context,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: ClassRecordContext;
}) {
  if (!client) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <RecordsContent
          key={`${client.id}-${context?.sessionId ?? "free"}`}
          client={client}
          context={context ?? { date: todayISO() }}
        />
      ) : null}
    </Dialog>
  );
}
