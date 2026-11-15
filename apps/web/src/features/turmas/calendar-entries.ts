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
  /** Versao curta para o card da grade (evento com varios: "Ana Souza +1"); o nome inteiro fica no title. */
  instructorShort?: string;
  /** Aula com instrutor substituto. */
  isSubstitute: boolean;
  /** Evento conduzido por convidado (nome livre). */
  isGuest: boolean;
  /** "3 de 10 alunos", "Turma lotada", "2 inscritos". */
  occupancy: string;
  /** Versao curta para o card da grade: "8/12", "2 inscritos". */
  occupancyShort: string;
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
    occupancyShort: `${s.occupiedCount}/${s.capacity}`,
    isFull: full,
    accessibleLabel,
  };
}

/** Primeiro de quem conduz e quantos mais: "Ana Souza +1", "Mika Galvão (conv.) +1". */
function blockInstructorsShort(s: EventSessionView): string | undefined {
  const named = s.instructors.filter((i) => i.name);
  if (named.length <= 1) return undefined;
  const first = named[0];
  return `${first.isGuest ? `${first.name} (conv.)` : first.name} +${named.length - 1}`;
}

/** "Ana e Sensei Kenji (convidado)": quem conduz o bloco, convidado marcado. */
function blockInstructors(s: EventSessionView): string {
  const names = s.instructors.map((i) => (i.isGuest ? `${i.name} (convidado)` : i.name)).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function eventEntry(s: EventSessionView): CalendarEntry {
  const hasCapacity = s.capacity !== undefined && s.capacity > 0;
  const full = hasCapacity && s.confirmedCount >= s.capacity!;
  const openOccupancy = s.confirmedCount === 1 ? "1 inscrito" : `${s.confirmedCount} inscritos`;
  return {
    id: `event:${s.id}`,
    kind: "event",
    href: `/events/sessions/${encodeURIComponent(s.id)}`,
    title: s.eventName,
    date: s.date,
    start: s.start,
    end: s.end,
    modalityName: s.modalityName,
    // Quem conduz o bloco, convidado ja marcado no texto ("Ana e Kenji (convidado)").
    instructorName: blockInstructors(s),
    instructorShort: blockInstructorsShort(s),
    isSubstitute: false,
    isGuest: false,
    occupancy: full ? "Evento lotado" : hasCapacity ? `${s.confirmedCount} de ${s.capacity} vagas` : openOccupancy,
    occupancyShort: hasCapacity ? `${s.confirmedCount}/${s.capacity}` : openOccupancy,
    isFull: full,
    accessibleLabel: `Evento ${s.eventName}, ${s.start} às ${s.end}, ${blockInstructors(s)}`,
  };
}

export type CalendarShow = "all" | "classes" | "events";
