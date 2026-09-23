"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useForm,
  useWatch,
  FormProvider,
  Controller,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  DateField,
  FieldShell,
  InputCurrency,
  InputNumber,
  InputText,
  SelectField,
  SwitchField,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@gestarahub/core/api-error";
import { plural } from "@gestarahub/core/format";
import {
  addMinutesToTime,
  checkSlotWithinBusinessHours,
  findInstructorConflicts,
  instructorConflictMessage,
  weekdayOf,
} from "@gestarahub/core/scheduling";
import type {
  ClassGroupView,
  CreateClassGroup,
  Unit,
  Weekday,
} from "@gestarahub/contracts";
import { useUnit } from "@/features/settings";
import { useCategories } from "@/features/categories";
import { useProfessionals } from "@/features/professionals";
import { useClassGroups, useCreateClassGroup, useUpdateClassGroup } from "../hooks/use-turmas";
import {
  getTurmaFormSchema,
  type TurmaFormValues,
} from "../turma-schema";

const WEEKDAYS = [
  { value: 0, short: "Dom" },
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
];

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
): { start: string; end: string } {
  const fallback = { start: "19:00", end: "20:00" };
  if (!unit?.businessHours || unit.businessHours.length === 0) {
    return fallback;
  }

  const dayConfig = unit.businessHours.find((b) => b.weekday === weekday);
  if (dayConfig && !dayConfig.closed) {
    const shift = dayConfig.shifts?.[0];
    const start = shift?.start ?? dayConfig.start;
    const shiftEnd = shift?.end ?? dayConfig.end;
    if (start) {
      const calculatedEnd = addMinutesToTime(start, 60);
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
      const calculatedEnd = addMinutesToTime(start, 60);
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
): ScheduleBlock[] {
  if (!slots || slots.length === 0) {
    const initialDate = startDate || format(new Date(), "yyyy-MM-dd");
    const weekday = weekdayOf(initialDate);
    const times = getUnitTimesForWeekday(weekday, unit);
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

/** Editor de encontros: suporta horário principal e horários adicionais opcionais (ex: Sábado). */
function MeetingSlotsEditor({
  value,
  onChange,
  disabled,
  error,
  unit,
  startDate,
  instructor,
  otherGroups,
  currentGroupId,
}: {
  value: TurmaFormValues["meetingSlots"];
  onChange: (v: TurmaFormValues["meetingSlots"]) => void;
  disabled?: boolean;
  error?: string;
  unit?: Unit;
  startDate?: string;
  /** Instrutor escolhido: cada bloco avisa na hora se ele ja da aula no horario. */
  instructor?: { id: string; name: string };
  otherGroups?: ClassGroupView[];
  currentGroupId?: string;
}) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() =>
    slotsToBlocks(value, unit, startDate),
  );
  const lastEmittedRef = useRef<string>(JSON.stringify(blocksToSlots(blocks)));

  useEffect(() => {
    const currentValJson = JSON.stringify(value ?? []);
    if (currentValJson !== lastEmittedRef.current) {
      const parsed = slotsToBlocks(value, unit, startDate);
      setBlocks(parsed);
      lastEmittedRef.current = JSON.stringify(blocksToSlots(parsed));
    }
  }, [value, unit, startDate]);

  const emitChange = (nextBlocks: ScheduleBlock[]) => {
    const nextSlots = blocksToSlots(nextBlocks);
    lastEmittedRef.current = JSON.stringify(nextSlots);
    onChange(nextSlots);
  };

  const updateBlockTime = (blockId: string, patch: Partial<{ start: string; end: string }>) => {
    const next = blocks.map((b) =>
      b.id === blockId ? { ...b, ...patch } : b,
    );
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
        ? getUnitTimesForWeekday(nextDay, unit)
        : { start: "18:00", end: "19:00" };

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
      const [conflict] = findInstructorConflicts(
        block.days.map((day) => ({ weekday: day as Weekday, start: block.start, end: block.end })),
        instructor.id,
        otherGroups ?? [],
        currentGroupId,
      );
      if (conflict) return instructorConflictMessage(instructor.name, conflict);
    }
    if (error && block.days.length === 0) {
      return "Selecione ao menos um dia da semana para este horário.";
    }
    return undefined;
  };
  const hasBlockError = blocks.some((b) => getBlockError(b) !== undefined);

  const allSelectedDaysCount = blocks.flatMap((b) => b.days).length;

  return (
    <FieldShell
      label="Encontros e Horários"
      hint="Dias e horários em que a turma se reúne no tatame."
    >
      <div className="space-y-3">
        {blocks.map((block, index) => {
          const isMain = index === 0;
          const isTimeInverted = isBlockTimeInverted(block);
          const blockError = getBlockError(block);
          const isCardInvalid = Boolean(blockError);
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
                <div className="space-y-1.5 min-w-0">
                  {blocks.length > 1 && (
                    <span className="text-xs font-semibold text-muted-foreground block">
                      {isMain ? "Horário principal:" : "Horário adicional:"}
                    </span>
                  )}
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
                              ? `${d.short}: Unidade fechada neste dia (configurações da academia)`
                              : `${d.short}: clique para ${on ? "desmarcar" : "marcar"}`
                        }
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold select-none transition-all disabled:opacity-35",
                          on
                            ? "border-primary bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/20"
                            : isClosed
                              ? "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                              : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span>{d.short}</span>
                          {isClosed && (
                            <span className="text-[8px] font-normal tracking-tight opacity-75">
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
            size="sm"
            onClick={addBlock}
            disabled={disabled}
            className="w-full border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar horário diferente (ex: Sábado ou manhã)
          </Button>
        )}
      </div>
    </FieldShell>
  );
}

export function TurmaForm({
  turma,
  formId,
  onSuccess,
}: {
  turma?: ClassGroupView;
  formId: string;
  onSuccess?: (created?: ClassGroupView) => void;
}) {
  const createMut = useCreateClassGroup();
  const updateMut = useUpdateClassGroup();
  const isEdit = Boolean(turma);
  const pending = createMut.isPending || updateMut.isPending;
  const { data: unit } = useUnit();
  const { data: categories } = useCategories({ status: "active" });
  const { data: professionals } = useProfessionals({ status: "active" });
  // Turmas ativas: o editor de horarios avisa conflito do instrutor ao vivo.
  const { data: activeGroups } = useClassGroups({ status: "active" });

  const openStartDate = useMemo(() => getInitialStartDate(unit), [unit]);
  const initialWeekday = useMemo(() => weekdayOf(openStartDate), [openStartDate]);
  const initialTimes = useMemo(
    () => getUnitTimesForWeekday(initialWeekday, unit),
    [initialWeekday, unit],
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
          meetingSlots: turma.meetingSlots,
        }
      : {
          name: "",
          modalityId: "",
          planId: "",
          instructorId: "",
          allowDropin: false,
          sessionPriceCents: 0,
          capacity: 10,
          startDate: openStartDate,
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
    if (currentStartDate !== openDate && !form.formState.dirtyFields.startDate) {
      form.setValue("startDate", openDate);
    }

    const currentSlots = form.getValues("meetingSlots") ?? [];
    if (currentSlots.length === 0 && !form.formState.dirtyFields.meetingSlots) {
      const weekday = weekdayOf(openDate);
      const times = getUnitTimesForWeekday(weekday, unit);
      const dayConfig = unit.businessHours.find((b) => b.weekday === weekday);
      if (!dayConfig || !dayConfig.closed) {
        form.setValue("meetingSlots", [
          {
            weekday,
            start: times.start,
            end: times.end,
          },
        ]);
      }
    }
  }, [unit, isEdit, form]);

  // Ao alterar a data de início da turma, atualiza os horários para refletir a configuração da unidade no novo dia da semana
  useEffect(() => {
    if (isEdit || !startDate || prevStartDateRef.current === startDate) return;
    const oldStartDate = prevStartDateRef.current;
    prevStartDateRef.current = startDate;

    const newWeekday = weekdayOf(startDate);
    const oldWeekday = oldStartDate ? weekdayOf(oldStartDate) : null;
    const times = getUnitTimesForWeekday(newWeekday, unit);
    const dayConfig = unit?.businessHours?.find((b) => b.weekday === newWeekday);
    const isNewDayOpen = !dayConfig || !dayConfig.closed;

    const currentSlots = form.getValues("meetingSlots") ?? [];
    const isSingleDefaultSlot =
      currentSlots.length === 0 ||
      (currentSlots.length === 1 && currentSlots[0].weekday === oldWeekday);

    if (isSingleDefaultSlot) {
      form.setValue(
        "meetingSlots",
        isNewDayOpen
          ? [
              {
                weekday: newWeekday,
                start: times.start,
                end: times.end,
              },
            ]
          : [],
      );
    }
  }, [startDate, unit, isEdit, form]);

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

    const payload: CreateClassGroup = {
      name: values.name,
      modalityId: values.modalityId,
      planId: values.planId || undefined,
      instructorId: values.instructorId,
      allowDropin: values.allowDropin,
      sessionPriceCents: values.allowDropin ? (values.sessionPriceCents || undefined) : undefined,
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
        onSuccess?.();
      } else {
        const created = await createMut.mutateAsync(payload);
        toast.success("Turma criada com sucesso.");
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
  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col min-h-0 flex-1 overflow-hidden"
      >
        <DialogBody className="space-y-4">
          <InputText<TurmaFormValues>
          name="name"
          label="Nome da turma"
          placeholder="Ex.: Jiu-Jitsu Fundamentos, No-Gi Avançado, Kids A"
          required
          disabled={pending}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField<TurmaFormValues>
            name="modalityId"
            label="Modalidade / Arte Marcial"
            placeholder="Selecione a modalidade"
            options={categoryOptions}
            required
            disabled={pending}
          />
          <SelectField<TurmaFormValues>
            name="instructorId"
            label="Professor / Instrutor"
            placeholder={
              !modalityId
                ? "Selecione a modalidade primeiro"
                : instructorOptions.length === 0
                  ? "Nenhum professor leciona esta modalidade"
                  : "Selecione o professor"
            }
            options={instructorOptions}
            required
            disabled={pending || !modalityId || instructorOptions.length === 0}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputNumber<TurmaFormValues>
            name="capacity"
            label="Capacidade (vagas)"
            min={1}
            hint={overCapacityHint}
            disabled={pending}
          />
          <DateField<TurmaFormValues>
            name="startDate"
            label="Data de início da turma"
            hint={startDateHint}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
          <SwitchField<TurmaFormValues>
            name="allowDropin"
            label="Permitir alunos avulsos nesta turma"
            hint="Permite inscrever alunos em aula avulsa (paga) nesta turma. A aula experimental é sempre permitida."
            disabled={pending}
          />

          {allowDropin ? (
            <InputCurrency<TurmaFormValues>
              name="sessionPriceCents"
              label="Valor da aula avulsa / diária"
              required
              disabled={pending}
            />
          ) : null}
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
              instructor={selectedInstructor}
              otherGroups={activeGroups}
              currentGroupId={turma?.id}
            />
          )}
        />
        </DialogBody>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 shrink-0 bg-background">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Criar turma"}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
