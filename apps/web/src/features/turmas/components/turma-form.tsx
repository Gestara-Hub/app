"use client";

import { useTeamWords } from "@/features/settings";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  useForm,
  useWatch,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { format, addDays } from "date-fns";
import {
  ComboboxField,
  DateField,
  FormSection,
  FieldShell,
  InputCurrency,
  InputNumber,
  InputText,
  SegmentedChoiceField,
  SelectField,
  SwitchField,
  type SegmentedChoiceOption,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Copy, Lock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import { classBillingMode, MAX_INSTALLMENTS } from "@gestarahub/core/billing";
import {
  addMinutesToTime,
  checkSlotWithinBusinessHours,
  findInstructorConflicts,
  instructorConflictMessage,
  weekdayOf,
} from "@gestarahub/core/scheduling";
import type {
  ClassBillingMode,
  ClassGroupView,
  CreateClassGroup,
  Unit,
  Weekday,
} from "@gestarahub/contracts";
import { useBusinessSegment, useUnit } from "@/features/settings";
import { useCategories } from "@/features/categories";
import { useProfessionals } from "@/features/professionals";
import { useClassGroups, useCreateClassGroup, useUpdateClassGroup } from "../hooks/use-turmas";
import { requestScheduleNotice, slotsChanged } from "../schedule-notice";
import { slotsSummary } from "./turmas-view";
import {
  getTurmaFormSchema,
  type TurmaFormValues,
} from "../turma-schema";
import { dateInSpace } from "@gestarahub/core/date";

const WEEKDAYS = [
  { value: 0, short: "Dom" },
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
];

const BILLING_MODE_OPTIONS: SegmentedChoiceOption[] = [
  { value: "membership", label: "Mensalidade", description: "Cada aluno paga pelo seu plano" },
  { value: "course", label: "Curso com valor fechado", description: "Valor único, à vista ou parcelado" },
  { value: "package", label: "Pacote de aulas", description: "Cada aula usa uma do pacote" },
  { value: "free", label: "Sem cobrança", description: "Turma gratuita, sem cobranças" },
];

const MAX_INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "À vista" : `${i + 1}x`,
}));

const WEEKDAY_NAMES_PT = [
  "domingos",
  "segundas-feiras",
  "terças-feiras",
  "quartas-feiras",
  "quintas-feiras",
  "sextas-feiras",
  "sábados",
];

export function getInitialStartDate(unit?: Unit): string {
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  if (!unit?.businessHours || unit.businessHours.length === 0) {
    return todayIso;
  }

  // Encontra o primeiro dia aberto a partir de hoje
  for (let i = 0; i < 7; i++) {
    const candidateDate = addDays(today, i);
    const candidateIso = format(candidateDate, "yyyy-MM-dd");
    const weekday = weekdayOf(candidateIso);
    const dayConfig = unit.businessHours.find((b) => b.weekday === weekday);
    if (!dayConfig || !dayConfig.closed) {
      return candidateIso;
    }
  }

  return todayIso;
}

export function getUnitTimesForWeekday(
  weekday: number,
  unit?: Unit,
  durationMinutes = 60,
): { start: string; end: string } {
  const fallback = { start: "19:00", end: addMinutesToTime("19:00", durationMinutes) };
  if (!unit?.businessHours || unit.businessHours.length === 0) {
    return fallback;
  }

  const dayConfig = unit.businessHours.find((b) => b.weekday === weekday);
  if (dayConfig && !dayConfig.closed) {
    const shift = dayConfig.shifts?.[0];
    const start = shift?.start ?? dayConfig.start;
    const shiftEnd = shift?.end ?? dayConfig.end;
    if (start) {
      const calculatedEnd = addMinutesToTime(start, durationMinutes);
      const end = shiftEnd && shiftEnd < calculatedEnd ? shiftEnd : calculatedEnd;
      return { start, end };
    }
  }

  // Se o dia específico estiver fechado, busca o primeiro dia aberto configurado na unidade
  const firstOpen = unit.businessHours.find(
    (b) => !b.closed && ((b.shifts && b.shifts.length > 0) || b.start),
  );
  if (firstOpen) {
    const shift = firstOpen.shifts?.[0];
    const start = shift?.start ?? firstOpen.start;
    const shiftEnd = shift?.end ?? firstOpen.end;
    if (start) {
      const calculatedEnd = addMinutesToTime(start, durationMinutes);
      const end = shiftEnd && shiftEnd < calculatedEnd ? shiftEnd : calculatedEnd;
      return { start, end };
    }
  }

  return fallback;
}

interface ScheduleBlock {
  id: string;
  start: string;
  end: string;
  days: number[];
}

function slotsToBlocks(
  slots: TurmaFormValues["meetingSlots"],
  unit?: Unit,
  startDate?: string,
  durationMinutes = 60,
): ScheduleBlock[] {
  if (!slots || slots.length === 0) {
    const initialDate = startDate || dateInSpace();
    const weekday = weekdayOf(initialDate);
    const times = getUnitTimesForWeekday(weekday, unit, durationMinutes);
    const dayConfig = unit?.businessHours?.find((b) => b.weekday === weekday);
    const isDayOpen = !dayConfig || !dayConfig.closed;
    return [
      {
        id: "block-1",
        start: times.start,
        end: times.end,
        days: isDayOpen ? [weekday] : [],
      },
    ];
  }

  const groupMap = new Map<string, { start: string; end: string; days: number[] }>();
  for (const slot of slots) {
    const key = `${slot.start}__${slot.end}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { start: slot.start, end: slot.end, days: [] });
    }
    const group = groupMap.get(key)!;
    if (!group.days.includes(slot.weekday)) {
      group.days.push(slot.weekday);
    }
  }

  const blocks: ScheduleBlock[] = [];
  let index = 1;
  for (const group of groupMap.values()) {
    blocks.push({
      id: `block-${index++}`,
      start: group.start,
      end: group.end,
      days: group.days.sort((a, b) => a - b),
    });
  }

  return blocks.length > 0
    ? blocks
    : [{ id: "block-1", start: "19:00", end: "20:00", days: [] }];
}

function blocksToSlots(blocks: ScheduleBlock[]): TurmaFormValues["meetingSlots"] {
  const slots: TurmaFormValues["meetingSlots"] = [];
  for (const block of blocks) {
    for (const weekday of block.days) {
      slots.push({
        weekday,
        start: block.start,
        end: block.end,
      });
    }
  }
  return slots.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Depois de mudar os dias de um bloco: se o horario atual sai do expediente de
 * algum dia marcado, procura (mantendo a duracao) um inicio que caiba em todos,
 * testando a abertura de cada dia marcado. Horario ja valido nao e mexido; sem
 * opcao que sirva a todos, fica como esta e o alerta mostra o conflito real.
 */
function fitBlockToDays(block: ScheduleBlock, unit?: Unit): ScheduleBlock {
  const hours = unit?.businessHours;
  if (!hours?.length || block.days.length === 0 || !block.start || !block.end) return block;
  const fitsAll = (start: string, end: string) =>
    block.days.every(
      (day) => checkSlotWithinBusinessHours(day as Weekday, start, end, hours).valid,
    );
  if (fitsAll(block.start, block.end)) return block;

  const duration = Math.max(15, toMinutes(block.end) - toMinutes(block.start));
  for (const day of block.days) {
    const { start } = getUnitTimesForWeekday(day, unit);
    const end = addMinutesToTime(start, duration);
    if (end > start && fitsAll(start, end)) return { ...block, start, end };
  }
  return block;
}

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h${rest}` : `${hours}h`;
}

/** Atalhos de duracao: 45m, 1h e 1h30, mais a duracao padrao da area se for outra. */
function durationShortcuts(defaultDuration: number): { label: string; mins: number }[] {
  const mins = Array.from(new Set([45, 60, 90, defaultDuration])).sort((a, b) => a - b);
  return mins.map((m) => ({ label: durationLabel(m), mins: m }));
}

/** Editor de encontros: suporta horário principal e horários adicionais opcionais (ex: Sábado). */
function MeetingSlotsEditor({
  value,
  onChange,
  disabled,
  error,
  unit,
  startDate,
  endDate,
  instructor,
  otherGroups,
  currentGroupId,
  defaultDuration = 60,
}: {
  value: TurmaFormValues["meetingSlots"];
  onChange: (v: TurmaFormValues["meetingSlots"]) => void;
  disabled?: boolean;
  error?: string;
  unit?: Unit;
  startDate?: string;
  /** Fim da turma: conflito so com turma que tenha dias em comum. */
  endDate?: string;
  /** Instrutor escolhido: cada bloco avisa na hora se ele ja da aula no horario. */
  instructor?: { id: string; name: string };
  otherGroups?: ClassGroupView[];
  currentGroupId?: string;
  /** Duracao padrao da area (ex.: 50 min no pilates): novos horarios e atalhos. */
  defaultDuration?: number;
}) {
  const team = useTeamWords();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() =>
    slotsToBlocks(value, unit, startDate, defaultDuration),
  );
  const lastEmittedRef = useRef<string>(JSON.stringify(blocksToSlots(blocks)));

  useEffect(() => {
    const currentValJson = JSON.stringify(value ?? []);
    if (currentValJson !== lastEmittedRef.current) {
      const parsed = slotsToBlocks(value, unit, startDate, defaultDuration);
      setBlocks(parsed);
      lastEmittedRef.current = JSON.stringify(blocksToSlots(parsed));
    }
  }, [value, unit, startDate, defaultDuration]);

  const emitChange = (nextBlocks: ScheduleBlock[]) => {
    const nextSlots = blocksToSlots(nextBlocks);
    lastEmittedRef.current = JSON.stringify(nextSlots);
    onChange(nextSlots);
  };

  const updateBlockTime = (blockId: string, patch: Partial<{ start: string; end: string }>) => {
    const next = blocks.map((b) => {
      if (b.id !== blockId) return b;
      // Quando muda apenas o inicio, preserva a duracao atual (ex.: 60m) para nao inverter inicio > fim
      if (patch.start && !patch.end && b.start && b.end) {
        const currentDuration = toMinutes(b.end) - toMinutes(b.start);
        const durationToKeep = currentDuration > 0 ? currentDuration : defaultDuration;
        const autoEnd = addMinutesToTime(patch.start, durationToKeep);
        return { ...b, start: patch.start, end: autoEnd };
      }
      return { ...b, ...patch };
    });
    setBlocks(next);
    emitChange(next);
  };

  const toggleDay = (blockId: string, weekday: number) => {
    const next = blocks.map((b) => {
      if (b.id !== blockId) return b;
      const hasDay = b.days.includes(weekday);
      const nextDays = hasDay
        ? b.days.filter((d) => d !== weekday)
        : [...b.days, weekday].sort((a, b) => a - b);
      return fitBlockToDays({ ...b, days: nextDays }, unit);
    });
    setBlocks(next);
    emitChange(next);
  };

  const addBlock = () => {
    const usedDays = new Set(blocks.flatMap((b) => b.days));
    const openDays = (unit?.businessHours ?? [])
      .filter((b) => !b.closed && ((b.shifts && b.shifts.length > 0) || b.start))
      .map((b) => b.weekday);

    // Prioriza o próximo dia aberto que ainda não foi alocado
    const nextOpenDay = openDays.find((d) => !usedDays.has(d));
    const fallbackDay = WEEKDAYS.find((d) => !usedDays.has(d.value))?.value;
    const nextDay = nextOpenDay !== undefined ? nextOpenDay : fallbackDay;

    const times =
      nextDay !== undefined
        ? getUnitTimesForWeekday(nextDay, unit, defaultDuration)
        : { start: "18:00", end: addMinutesToTime("18:00", defaultDuration) };

    const maxNum = blocks.reduce(
      (max, b) => Math.max(max, parseInt(b.id.replace(/\D/g, "") || "0", 10)),
      0,
    );
    const next: ScheduleBlock[] = [
      ...blocks,
      {
        id: `block-${maxNum + 1}`,
        start: times.start,
        end: times.end,
        days: nextDay !== undefined ? [nextDay] : [],
      },
    ];
    setBlocks(next);
    emitChange(next);
  };

  const removeBlock = (blockId: string) => {
    const next = blocks.filter((b) => b.id !== blockId);
    setBlocks(next);
    emitChange(next);
  };

  const isDayUsedElsewhere = (weekday: number, currentBlockId: string) => {
    return blocks.some((b) => b.id !== currentBlockId && b.days.includes(weekday));
  };

  const isBlockTimeInverted = (block: ScheduleBlock) =>
    Boolean(block.start && block.end && block.start >= block.end);

  /** Erro proprio do bloco: horario invertido, fora do expediente, conflito do instrutor ou sem dias. */
  const getBlockError = (block: ScheduleBlock): string | undefined => {
    if (isBlockTimeInverted(block)) {
      return "Horário inválido: informe início e fim (o início deve ser antes do fim).";
    }
    if (block.start && block.end && unit?.businessHours?.length) {
      for (const day of block.days) {
        const check = checkSlotWithinBusinessHours(
          day as Weekday,
          block.start,
          block.end,
          unit.businessHours,
        );
        if (!check.valid && check.message) return check.message;
      }
    }
    if (instructor && block.start && block.end) {
      const today = dateInSpace();
      const [conflict] = findInstructorConflicts(
        block.days.map((day) => ({ weekday: day as Weekday, start: block.start, end: block.end })),
        instructor.id,
        otherGroups ?? [],
        currentGroupId,
        startDate
          ? { startDate: startDate > today ? startDate : today, endDate: endDate || undefined }
          : undefined,
      );
      if (conflict) return instructorConflictMessage(instructor.name, conflict, team.lower);
    }
    if (error && block.days.length === 0) {
      return "Selecione ao menos um dia da semana para este horário.";
    }
    return undefined;
  };
  const hasBlockError = blocks.some((b) => getBlockError(b) !== undefined);

  const allSelectedDaysCount = blocks.flatMap((b) => b.days).length;

  return (
    <FieldShell label="Encontros e Horários" required invalid={Boolean(error)}>
      <div className="space-y-2.5">
        {blocks.map((block, index) => {
          const isMain = index === 0;
          const isTimeInverted = isBlockTimeInverted(block);
          const blockError = getBlockError(block);
          const isCardInvalid = Boolean(blockError);
          const durationMinutes =
            block.start && block.end ? toMinutes(block.end) - toMinutes(block.start) : 0;

          return (
            <div
              key={block.id}
              aria-invalid={isCardInvalid}
              className={cn(
                "space-y-3 rounded-lg border bg-muted/15 p-3.5 transition-colors",
                isCardInvalid ? "border-destructive" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0 flex-1">
                  {blocks.length > 1 && (
                    <span className="text-xs font-semibold text-muted-foreground block">
                      {isMain ? "Horário principal:" : "Horário adicional:"}
                    </span>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="w-28">Início</span>
                        <span className="invisible text-sm select-none">às</span>
                        <span className="w-28">Fim</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={300}
                          value={block.start}
                          onChange={(e) =>
                            updateBlockTime(block.id, { start: e.target.value })
                          }
                          disabled={disabled}
                          aria-invalid={isTimeInverted}
                          aria-label="Início do encontro"
                          className={cn(
                            "h-8 w-28 bg-background",
                            isTimeInverted &&
                              "border-destructive focus-visible:ring-destructive/40",
                          )}
                        />
                        <span className="text-sm text-muted-foreground">às</span>
                        <Input
                          type="time"
                          step={300}
                          value={block.end}
                          onChange={(e) =>
                            updateBlockTime(block.id, { end: e.target.value })
                          }
                          disabled={disabled}
                          aria-invalid={isTimeInverted}
                          aria-label="Fim do encontro"
                          className={cn(
                            "h-8 w-28 bg-background",
                            isTimeInverted &&
                              "border-destructive focus-visible:ring-destructive/40",
                          )}
                        />
                      </div>
                    </div>

                    {/* Atalhos discretos de duração da aula */}
                    <div className="flex items-center gap-1">
                      {durationShortcuts(defaultDuration).map((preset) => {
                        const active = durationMinutes === preset.mins;
                        return (
                          <button
                            key={preset.mins}
                            type="button"
                            disabled={disabled || !block.start}
                            onClick={() =>
                              updateBlockTime(block.id, {
                                end: addMinutesToTime(block.start, preset.mins),
                              })
                            }
                            className={cn(
                              "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer",
                              active
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:text-foreground",
                            )}
                            title={`Definir duração de ${preset.label}`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {!isMain && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeBlock(block.id)}
                    disabled={disabled}
                    title="Remover horário"
                    aria-label="Remover horário"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 mt-0.5"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {blocks.length > 1 ? "Dias deste horário" : "Dias da semana"}
                </p>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = block.days.includes(d.value);
                    const usedElsewhere = isDayUsedElsewhere(d.value, block.id);
                    const dayConfig = unit?.businessHours?.find((b) => b.weekday === d.value);
                    const isClosed = Boolean(dayConfig && dayConfig.closed);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(block.id, d.value)}
                        disabled={disabled || usedElsewhere}
                        aria-pressed={on}
                        title={
                          usedElsewhere
                            ? `${d.short}: já marcado em outro horário`
                            : isClosed
                              ? `${d.short}: Unidade fechada neste dia (configurações do espaço)`
                              : `${d.short}: clique para ${on ? "desmarcar" : "marcar"}`
                        }
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold select-none transition-all disabled:opacity-35",
                          on
                            ? "border-primary bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/20"
                            : isClosed
                              ? "border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                              : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span>{d.short}</span>
                          {isClosed && (
                            <span className="text-[9px] font-normal tracking-tight">
                              fechado
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {blockError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{blockError}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Erro do campo (ex.: devolvido pelo servidor) que nenhum bloco explica sozinho. */}
        {error && !hasBlockError ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {allSelectedDaysCount < 7 && blocks.length < 7 && (
          <Button
            type="button"
            variant="outline"
            onClick={addBlock}
            disabled={disabled}
            className="w-full border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar outro horário
          </Button>
        )}
      </div>
    </FieldShell>
  );
}

/** O que muda para quem ja esta matriculado ao trocar a forma de cobranca. */
const BILLING_CHANGE_TEXT: Record<ClassBillingMode, string> = {
  membership: "Eles passam a pagar pela mensalidade do plano de cada um.",
  package: "Cada presença passa a gastar uma aula do pacote; quem não tem fica \"Sem pacote\".",
  course: "As matrículas atuais não ganham parcelas do curso; só as novas.",
  free: "A turma deixa de cobrar das próximas aulas.",
};

export function TurmaForm({
  turma,
  template,
  onDuplicate,
  formId,
  onSuccess,
  onCancel,
  isPage = false,
}: {
  turma?: ClassGroupView;
  /** Duplicar turma (25/11/2026): nova turma ja preenchida com esta, sem alunos nem aulas. */
  template?: ClassGroupView;
  /** Cobranca travada: o botao "Duplicar turma" do aviso. */
  onDuplicate?: () => void;
  formId: string;
  onSuccess?: (created?: ClassGroupView) => void;
  onCancel?: () => void;
  isPage?: boolean;
}) {
  const team = useTeamWords();
  const createMut = useCreateClassGroup();
  const updateMut = useUpdateClassGroup();
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();
  const isEdit = Boolean(turma);
  // Editando ou duplicando: os valores vieram de uma turma, as sugestoes da area nao mexem neles.
  const prefilled = isEdit || Boolean(template);
  // Matricula ativa: a cobranca trava (o servidor tambem recusa). Curso que ja
  // comecou com alunos: as datas seguem travadas (doc product/11, 27/11/2026).
  const billingLocked = isEdit && Boolean(turma?.billingLocked);
  const datesLocked = isEdit && Boolean(turma?.courseDatesLocked);
  const pending = createMut.isPending || updateMut.isPending;
  const { data: unit } = useUnit();
  const { classDefaults, defaultBillingMode } = useBusinessSegment();
  const { data: categories } = useCategories({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  // Turmas ativas: o editor de horarios avisa conflito do instrutor ao vivo.
  const { data: activeGroups } = useClassGroups({ status: "active" });

  const openStartDate = useMemo(() => getInitialStartDate(unit), [unit]);
  const initialWeekday = useMemo(() => weekdayOf(openStartDate), [openStartDate]);
  const initialTimes = useMemo(
    () => getUnitTimesForWeekday(initialWeekday, unit, classDefaults.durationMinutes),
    [initialWeekday, unit, classDefaults.durationMinutes],
  );
  const isInitialDayOpen = useMemo(() => {
    const dayConfig = unit?.businessHours?.find((b) => b.weekday === initialWeekday);
    return !dayConfig || !dayConfig.closed;
  }, [unit, initialWeekday]);

  const schema = useMemo(() => getTurmaFormSchema(unit), [unit]);

  const form = useForm<TurmaFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: turma
      ? {
          name: turma.name,
          modalityId: turma.modalityId ?? "",
          planId: turma.planId ?? "",
          instructorId: turma.instructorId,
          // Ausente = aceita avulso (mesma regra do service, doc 11).
          allowDropin: turma.allowDropin ?? true,
          sessionPriceCents: turma.sessionPriceCents ?? 0,
          capacity: turma.capacity,
          startDate: turma.startDate,
          billingMode: classBillingMode(turma),
          coursePriceCents: turma.coursePriceCents ?? 0,
          courseMaxInstallments: String(turma.courseMaxInstallments ?? 1),
          endDate: turma.endDate ?? "",
          meetingSlots: turma.meetingSlots,
        }
      : template
        ? {
            name: `${template.name} (cópia)`,
            modalityId: template.modalityId ?? "",
            planId: template.planId ?? "",
            instructorId: template.instructorId,
            allowDropin: template.allowDropin ?? true,
            sessionPriceCents: template.sessionPriceCents ?? 0,
            capacity: template.capacity,
            // Datas novas: a turma copiada pode ser de meses atras.
            startDate: openStartDate,
            billingMode: classBillingMode(template),
            coursePriceCents: template.coursePriceCents ?? 0,
            courseMaxInstallments: String(template.courseMaxInstallments ?? 1),
            endDate: "",
            meetingSlots: template.meetingSlots,
          }
        : {
          name: "",
          modalityId: "",
          planId: "",
          instructorId: "",
          allowDropin: false,
          sessionPriceCents: 0,
          capacity: classDefaults.capacity,
          startDate: openStartDate,
          // A area sugere a forma (gastronomia, artes e beleza: curso).
          billingMode: defaultBillingMode,
          coursePriceCents: 0,
          courseMaxInstallments: "1",
          endDate: "",
          meetingSlots: isInitialDayOpen
            ? [
                {
                  weekday: initialWeekday,
                  start: initialTimes.start,
                  end: initialTimes.end,
                },
              ]
            : [],
        },
  });

  const startDate = useWatch({
    control: form.control,
    name: "startDate",
  });
  const endDate = useWatch({
    control: form.control,
    name: "endDate",
  });
  const prevStartDateRef = useRef(startDate);

  // Sincroniza a data inicial e horários quando os dados da unidade chegam pela primeira vez (se pristine)
  const unitLoadedRef = useRef(false);
  useEffect(() => {
    if (isEdit || !unit?.businessHours || unit.businessHours.length === 0 || unitLoadedRef.current) {
      return;
    }
    unitLoadedRef.current = true;

    const currentStartDate = form.getValues("startDate");
    const openDate = getInitialStartDate(unit);
    // Sugestao vira o novo valor inicial (resetField): nao conta como edicao
    // da pessoa e nao trava as sugestoes seguintes (doc 07 §2.8).
    if (currentStartDate !== openDate && !form.getFieldState("startDate").isDirty) {
      form.resetField("startDate", { defaultValue: openDate });
    }

    const currentSlots = form.getValues("meetingSlots") ?? [];
    if (currentSlots.length === 0 && !form.getFieldState("meetingSlots").isDirty) {
      const weekday = weekdayOf(openDate);
      const times = getUnitTimesForWeekday(weekday, unit, classDefaults.durationMinutes);
      const dayConfig = unit.businessHours.find((b) => b.weekday === weekday);
      if (!dayConfig || !dayConfig.closed) {
        form.resetField("meetingSlots", {
          defaultValue: [
            {
              weekday,
              start: times.start,
              end: times.end,
            },
          ],
        });
      }
    }
  }, [unit, isEdit, form, classDefaults.durationMinutes]);

  // Ao alterar a data de início da turma, atualiza os horários para refletir a configuração da unidade no novo dia da semana
  useEffect(() => {
    if (prefilled || !startDate || prevStartDateRef.current === startDate) return;
    const oldStartDate = prevStartDateRef.current;
    prevStartDateRef.current = startDate;

    const newWeekday = weekdayOf(startDate);
    const oldWeekday = oldStartDate ? weekdayOf(oldStartDate) : null;
    const times = getUnitTimesForWeekday(newWeekday, unit, classDefaults.durationMinutes);
    const dayConfig = unit?.businessHours?.find((b) => b.weekday === newWeekday);
    const isNewDayOpen = !dayConfig || !dayConfig.closed;

    const currentSlots = form.getValues("meetingSlots") ?? [];
    const isSingleDefaultSlot =
      currentSlots.length === 0 ||
      (currentSlots.length === 1 && currentSlots[0].weekday === oldWeekday);

    if (isSingleDefaultSlot) {
      // Horario sugerido para o novo dia: valor inicial, nao edicao (doc 07 §2.8).
      form.resetField("meetingSlots", {
        defaultValue: isNewDayOpen
          ? [
              {
                weekday: newWeekday,
                start: times.start,
                end: times.end,
              },
            ]
          : [],
      });
    }
  }, [startDate, unit, prefilled, form, classDefaults.durationMinutes]);

  const startDateWeekday = startDate ? weekdayOf(startDate) : null;
  const isStartDateClosed = useMemo(() => {
    if (startDateWeekday === null || !unit?.businessHours || unit.businessHours.length === 0) {
      return false;
    }
    const dayConfig = unit.businessHours.find((b) => b.weekday === startDateWeekday);
    return Boolean(dayConfig && dayConfig.closed);
  }, [startDateWeekday, unit]);

  const startDateHint =
    isStartDateClosed && startDateWeekday !== null
      ? `Atenção: a unidade está configurada como fechada aos ${WEEKDAY_NAMES_PT[startDateWeekday]}.`
      : undefined;

  const capacityValue = useWatch({ control: form.control, name: "capacity" });
  // Lotacao e regra flexivel: reduzir abaixo dos matriculados so avisa.
  const overCapacityHint =
    turma && typeof capacityValue === "number" && capacityValue < turma.enrolledCount
      ? `A turma tem ${turma.enrolledCount} matriculados: com ${plural(capacityValue, "vaga", "vagas")}, ela ficará acima da capacidade.`
      : undefined;
  const allowDropin = useWatch({
    control: form.control,
    name: "allowDropin",
  });
  const billingMode = useWatch({ control: form.control, name: "billingMode" });
  // A area chega depois do 1o render (organizacao carregando): a forma
  // sugerida acompanha enquanto o usuario nao escolheu outra.
  useEffect(() => {
    if (prefilled || form.getFieldState("billingMode").isDirty) return;
    if (form.getValues("billingMode") === defaultBillingMode) return;
    form.resetField("billingMode", { defaultValue: defaultBillingMode });
  }, [defaultBillingMode, prefilled, form]);
  // Idem para as vagas e a duracao do encontro padrao (ex.: pilates 6 vagas e
  // 50 min): sem isso, abrir a nova turma antes da organizacao carregar deixava
  // os padroes de lutas (20 vagas, 1h).
  const prevDurationRef = useRef(classDefaults.durationMinutes);
  useEffect(() => {
    if (prefilled) return;
    if (!form.getFieldState("capacity").isDirty && form.getValues("capacity") !== classDefaults.capacity) {
      form.resetField("capacity", { defaultValue: classDefaults.capacity });
    }
    const previous = prevDurationRef.current;
    prevDurationRef.current = classDefaults.durationMinutes;
    if (previous === classDefaults.durationMinutes || form.getFieldState("meetingSlots").isDirty) return;
    const slots = form.getValues("meetingSlots") ?? [];
    if (slots.length !== 1) return;
    const [slot] = slots;
    // So o encontro padrao, ainda com a duracao antiga.
    const before = getUnitTimesForWeekday(slot.weekday, unit, previous);
    if (before.start !== slot.start || before.end !== slot.end) return;
    const after = getUnitTimesForWeekday(slot.weekday, unit, classDefaults.durationMinutes);
    form.resetField("meetingSlots", { defaultValue: [{ ...slot, end: after.end }] });
  }, [classDefaults.capacity, classDefaults.durationMinutes, prefilled, form, unit]);
  const isCourse = billingMode === "course";

  const modalityId = useWatch({
    control: form.control,
    name: "modalityId",
  });

  const instructorId = useWatch({
    control: form.control,
    name: "instructorId",
  });
  const selectedProfessional = (professionals ?? []).find((p) => p.id === instructorId);
  const selectedInstructor = selectedProfessional
    ? { id: selectedProfessional.id, name: selectedProfessional.name }
    : undefined;

  // Rastreia a última modalidade para detectar mudanças
  const prevModalityRef = useRef<string>(turma?.modalityId ?? "");

  // Ao alterar a modalidade, valida se o instrutor atual continua elegível ou auto-seleciona se houver apenas 1
  useEffect(() => {
    if (prevModalityRef.current === modalityId) return;
    prevModalityRef.current = modalityId;

    if (!modalityId) {
      if (instructorId) {
        form.setValue("instructorId", "", { shouldValidate: true });
      }
      return;
    }

    const eligible = (professionals ?? []).filter((p) =>
      (p.modalityIds ?? []).includes(modalityId),
    );

    if (instructorId && !eligible.some((p) => p.id === instructorId)) {
      form.setValue("instructorId", "", { shouldValidate: true });
    } else if (!instructorId && eligible.length === 1) {
      form.setValue("instructorId", eligible[0].id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [modalityId, instructorId, professionals, form]);


  const onSubmit = form.handleSubmit(async (values) => {
    if (unit?.businessHours && unit.businessHours.length > 0) {
      for (const slot of values.meetingSlots) {
        const check = checkSlotWithinBusinessHours(
          slot.weekday as Weekday,
          slot.start,
          slot.end,
          unit.businessHours,
        );
        if (!check.valid && check.message) {
          form.setError("meetingSlots", { message: check.message });
          return;
        }
      }
    }

    const mode = values.billingMode;
    // Trocar a forma de cobranca com alunos matriculados diz o que muda antes.
    if (turma && turma.enrolledCount > 0 && classBillingMode(turma) !== mode) {
      const fromCourse = classBillingMode(turma) === "course";
      const ok = await confirmAction({
        title: "Mudar a forma de cobrança?",
        description: `${plural(turma.enrolledCount, "aluno matriculado", "alunos matriculados")}. ${BILLING_CHANGE_TEXT[mode]}${fromCourse ? " A data de fim do curso sai." : ""}`,
        confirmLabel: "Mudar a cobrança",
        variant: "default",
      });
      if (!ok) return;
    }
    // Turma sem cobranca nao aceita avulso pago.
    const dropin = mode !== "free" && values.allowDropin;
    const payload: CreateClassGroup = {
      name: values.name,
      modalityId: values.modalityId,
      planId: mode === "membership" ? values.planId || undefined : undefined,
      instructorId: values.instructorId,
      allowDropin: dropin,
      sessionPriceCents: dropin ? (values.sessionPriceCents || undefined) : undefined,
      billingMode: mode,
      coursePriceCents: mode === "course" ? values.coursePriceCents || undefined : undefined,
      courseMaxInstallments: mode === "course" ? Number(values.courseMaxInstallments) : undefined,
      // Fim so aparece no curso; turma que deixa de ser curso perde o fim dele,
      // e a mensalidade com fim antigo (sem campo na tela) o mantem.
      endDate:
        mode === "course"
          ? values.endDate || undefined
          : turma && classBillingMode(turma) !== "course"
            ? turma.endDate
            : undefined,
      capacity: values.capacity,
      meetingSlots: values.meetingSlots.map((s) => ({
        weekday: s.weekday as Weekday,
        start: s.start,
        end: s.end,
      })),
      startDate: values.startDate,
      status: "active",
    };
    try {
      if (isEdit && turma) {
        await updateMut.mutateAsync({ id: turma.id, payload });
        toast.success("Turma atualizada com sucesso.");
        // Horario novo: oferece avisar os alunos (doc product/25).
        if (slotsChanged(turma.meetingSlots, payload.meetingSlots)) {
          requestScheduleNotice({
            classGroupId: turma.id,
            className: payload.name ?? turma.name,
            slotsText: slotsSummary(payload.meetingSlots),
          });
        }
        onSuccess?.();
      } else {
        const created = await createMut.mutateAsync(payload);
        onSuccess?.(created);
      }
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields && fields.length > 0) {
        for (const f of fields) {
          form.setError(f.field as Path<TurmaFormValues>, { message: f.message });
        }
      } else {
        toast.error(getErrorMessage(error, "Não foi possível salvar a turma."));
      }
    }
  });

  const categoryOptions = (categories ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));
  const eligibleInstructors = (professionals ?? []).filter((p) =>
    modalityId ? (p.modalityIds ?? []).includes(modalityId) : false,
  );
  const instructorOptions = eligibleInstructors.map((p) => ({
    label: p.name,
    value: p.id,
  }));
  // Modalidade ou professor da turma que foi inativado: aparece marcado (antes
  // o campo ficava vazio e salvava mantendo). TUR-20.
  const inactiveModality =
    turma?.modalityId &&
    categories &&
    !categories.some((c) => c.id === turma.modalityId) &&
    modalityId === turma.modalityId;
  if (inactiveModality && turma?.modalityId) {
    categoryOptions.push({ label: `${turma.modalityName ?? "Modalidade"} (inativa)`, value: turma.modalityId });
  }
  const inactiveInstructor =
    turma &&
    professionals &&
    !professionals.some((p) => p.id === turma.instructorId) &&
    instructorId === turma.instructorId;
  if (inactiveInstructor) {
    instructorOptions.push({ label: `${turma.instructorName} (inativo)`, value: turma.instructorId });
  }
  const FormBodyWrapper = isPage ? "div" : DialogBody;

  return (
    <FormProvider {...form}>
      {confirmDialog}
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className={cn(
          "flex flex-col min-h-0 flex-1",
          isPage ? "overflow-visible" : "overflow-hidden"
        )}
      >
        <FormBodyWrapper className={isPage ? "space-y-8 p-6 sm:space-y-4" : "space-y-8 sm:space-y-4"}>
          {/* Mesma ordem do cadastro de evento (doc 07 §2.9): sobre, quem conduz, quando, vagas e cobranca. */}
          <FormSection title="Sobre a turma">
            <InputText<TurmaFormValues>
              name="name"
              label="Nome da turma"
              placeholder="Informe o nome da turma"
              required
              disabled={pending}
            />
            <ComboboxField<TurmaFormValues>
              name="modalityId"
              label="Modalidade"
              placeholder="Selecione a modalidade"
              searchPlaceholder="Filtrar modalidade..."
              emptyMessage="Nenhuma modalidade encontrada."
              options={categoryOptions}
              required
              disabled={pending}
              hint={inactiveModality ? "Modalidade inativa. Reative ou escolha outra." : undefined}
            />
          </FormSection>

          <FormSection title="Quem conduz">
            <ComboboxField<TurmaFormValues>
              name="instructorId"
              label={team.title}
              placeholder={
                !modalityId
                  ? "Escolha a modalidade antes"
                  : instructorOptions.length === 0
                    ? `Sem ${team.lower} nesta modalidade`
                    : `Selecione o ${team.lower}`
              }
              searchPlaceholder={`Filtrar ${team.lower}...`}
              emptyMessage={`Nenhum ${team.lower} encontrado.`}
              options={instructorOptions}
              required
              disabled={pending || !modalityId || instructorOptions.length === 0}
              hint={inactiveInstructor ? `${team.title} inativo. Escolha outro para as próximas aulas.` : undefined}
            />
          </FormSection>

          <FormSection title="Quando">
            <div className="sm:w-1/2 sm:pr-2">
              <DateField<TurmaFormValues>
                name="startDate"
                label="Data de início da turma"
                hint={datesLocked && isCourse ? "As aulas e as parcelas do curso seguem o período." : startDateHint}
                required
                disabled={pending || (datesLocked && isCourse)}
              />
            </div>
            <Controller
              control={form.control}
              name="meetingSlots"
              render={({ field, fieldState }) => (
                <MeetingSlotsEditor
                  value={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                  error={fieldState.error?.message}
                  unit={unit}
                  startDate={startDate}
                  endDate={endDate}
                  instructor={selectedInstructor}
                  otherGroups={activeGroups}
                  currentGroupId={turma?.id}
                  defaultDuration={classDefaults.durationMinutes}
                />
              )}
            />
          </FormSection>

          <FormSection title="Vagas e cobrança">
            <div className="sm:w-1/2 sm:pr-2">
              <InputNumber<TurmaFormValues>
                name="capacity"
                label="Vagas"
                min={1}
                hint={overCapacityHint}
                required
                disabled={pending}
              />
            </div>
            {/* A dica de cada forma fica no proprio cartao (sem repetir abaixo). */}
            <FieldShell label="Cobrança">
              <div className="space-y-3">
                {billingLocked || (datesLocked && isCourse) ? (
                  <div
                    data-testid="billing-locked"
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        {billingLocked
                          ? "Já há alunos matriculados. Para mudar a cobrança, duplique a turma."
                          : "O curso já teve aulas. Para uma nova turma, duplique."}
                      </span>
                    </p>
                    {onDuplicate ? (
                      <Button type="button" variant="outline" className="shrink-0" onClick={onDuplicate} disabled={pending}>
                        <Copy className="size-4" />
                        Duplicar turma
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <SegmentedChoiceField<TurmaFormValues>
                  name="billingMode"
                  ariaLabel="Cobrança"
                  options={BILLING_MODE_OPTIONS}
                  variant="cards"
                  disabled={pending || billingLocked}
                />
                {isCourse ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputCurrency<TurmaFormValues>
                      name="coursePriceCents"
                      label="Valor do curso"
                      required
                      disabled={pending || billingLocked}
                    />
                    <SelectField<TurmaFormValues>
                      name="courseMaxInstallments"
                      label="Parcelas até"
                      options={MAX_INSTALLMENT_OPTIONS}
                      clearable={false}
                      disabled={pending || billingLocked}
                    />
                    <DateField<TurmaFormValues>
                      name="endDate"
                      label="Termina em"
                      hint="Curso tem data para acabar."
                      required
                      disabled={pending || datesLocked}
                    />
                  </div>
                ) : null}
              </div>
            </FieldShell>
            {billingMode === "free" ? null : (
              <div className="space-y-3">
                <SwitchField<TurmaFormValues>
                  name="allowDropin"
                  label="Permitir alunos avulsos nesta turma"
                  hint="Permite inscrever alunos em aula avulsa (paga) nesta turma. A aula experimental é sempre permitida."
                  disabled={pending}
                />

                {allowDropin ? (
                  <div className="sm:w-1/2 sm:pr-2">
                    <InputCurrency<TurmaFormValues>
                      name="sessionPriceCents"
                      label="Valor da aula avulsa / diária"
                      required
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </FormSection>
        </FormBodyWrapper>

        {isPage ? (
          <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-end gap-3 shadow-lg rounded-b-xl">
            {onCancel && (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Adicionar"}
            </Button>
          </div>
        ) : (
          <DialogFooter saving={pending} className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
            {onCancel ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancelar
              </Button>
            ) : (
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancelar
                </Button>
              </DialogClose>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Adicionar"}
            </Button>
          </DialogFooter>
        )}
      </form>
    </FormProvider>
  );
}
