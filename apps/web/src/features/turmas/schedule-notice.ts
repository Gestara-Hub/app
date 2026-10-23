import type { ClassMeetingSlot, Id } from "@gestarahub/contracts";

/**
 * Aviso de mudanca de horario (doc product/25): o formulario da turma pede
 * (`requestScheduleNotice`) e o `ScheduleNoticeHost`, no layout do app,
 * pergunta se avisa os alunos e abre o envio em sequencia.
 */

export interface ScheduleNoticeRequest {
  classGroupId: Id;
  className: string;
  /** Horario novo por extenso ("Seg e Qua · 19:00 às 20:00"). */
  slotsText: string;
}

const EVENT = "gestarahub:schedule-notice";

export function requestScheduleNotice(request: ScheduleNoticeRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ScheduleNoticeRequest>(EVENT, { detail: request }));
}

export function onScheduleNoticeRequest(handler: (request: ScheduleNoticeRequest) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<ScheduleNoticeRequest>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** O horario mudou de verdade (dia, inicio ou fim), sem olhar a ordem. */
export function slotsChanged(before: ClassMeetingSlot[] = [], after: ClassMeetingSlot[] = []): boolean {
  const key = (slots: ClassMeetingSlot[]) =>
    slots
      .map((s) => `${s.weekday}-${s.start}-${s.end}`)
      .sort()
      .join("|");
  return key(before) !== key(after);
}
