import type { EventSessionView } from "@gestarahub/contracts";
import type { ClassSessionListItem } from "@/services/classes";

/**
 * Item do Calendario (doc product/29 §Calendario compartilhado): aula de turma
 * ou dia de evento, no mesmo formato para a grade e a lista. O evento tem cor
 * propria fixa (cor diz tipo, nao modalidade, como ja decidido para as turmas).
 */
export interface CalendarEntry {
  id: string;
  kind: "class" | "event";
  href: string;
  title: string;
  date: string;
  start: string;
  end: string;
  modalityName?: string;
  instructorName: string;
  /** Aula com instrutor substituto. */
  isSubstitute: boolean;
  /** Evento conduzido por convidado (nome livre). */
  isGuest: boolean;
  /** "3 de 10 alunos", "Turma lotada", "2 inscritos". */
  occupancy: string;
  isFull: boolean;
  /** Texto do leitor de tela. */
  accessibleLabel: string;
}

export function classEntry(s: ClassSessionListItem, accessibleLabel: string): CalendarEntry {
  const full = s.occupiedCount >= s.capacity;
  return {
    id: s.id,
    kind: "class",
    href: `/classes/sessions/${encodeURIComponent(s.id)}`,
    title: s.className,
    date: s.date,
    start: s.start,
    end: s.end,
    modalityName: s.modalityName,
    instructorName: s.instructorName,
    isSubstitute: Boolean(s.isSubstitute),
    isGuest: false,
    occupancy: full ? "Turma lotada" : `${s.occupiedCount} de ${s.capacity} alunos`,
    isFull: full,
    accessibleLabel,
  };
}

export function eventEntry(s: EventSessionView): CalendarEntry {
  return {
    id: `event:${s.id}`,
    kind: "event",
    href: `/events/sessions/${encodeURIComponent(s.id)}`,
    title: s.eventName,
    date: s.date,
    start: s.start,
    end: s.end,
    modalityName: s.modalityName,
    instructorName: s.instructorName,
    isSubstitute: false,
    isGuest: s.isGuestInstructor,
    occupancy: s.confirmedCount === 1 ? "1 inscrito" : `${s.confirmedCount} inscritos`,
    isFull: false,
    accessibleLabel: `Evento ${s.eventName}, ${s.start} às ${s.end}, ${s.instructorName}`,
  };
}

export type CalendarShow = "all" | "classes" | "events";
