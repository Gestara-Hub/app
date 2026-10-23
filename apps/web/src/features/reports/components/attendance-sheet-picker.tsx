"use client";

import type { AttendanceReportData } from "@gestarahub/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "seg, 21/09 · 06:00". */
export function sessionOptionLabel(date: string, start: string): string {
  const weekday = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(`${date}T12:00:00`).getDay()];
  return `${weekday}, ${date.slice(8, 10)}/${date.slice(5, 7)} · ${start}`;
}

/** Lista de presenca: turma e aula escolhidas acima da previa (fora do documento). */
export function AttendanceSheetPicker({
  data,
  onSheetChange,
}: {
  data: AttendanceReportData;
  onSheetChange: (sheet: { classGroupId?: string; sessionId?: string }) => void;
}) {
  if (data.classOptions.length === 0) return null;
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-2 sm:grid-cols-2 print:hidden">
      <Select value={data.classGroupId} onValueChange={(classGroupId) => onSheetChange({ classGroupId })}>
        <SelectTrigger aria-label="Turma" className="w-full">
          <SelectValue placeholder="Turma" />
        </SelectTrigger>
        <SelectContent>
          {data.classOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={data.sessionId}
        onValueChange={(sessionId) => onSheetChange({ classGroupId: data.classGroupId, sessionId })}
        disabled={data.sessionOptions.length === 0}
      >
        <SelectTrigger aria-label="Aula" className="w-full">
          <SelectValue placeholder="Nenhuma aula neste mês" />
        </SelectTrigger>
        <SelectContent>
          {[...data.sessionOptions].reverse().map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {sessionOptionLabel(option.date, option.start)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
