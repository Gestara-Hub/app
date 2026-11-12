import type { AttendanceChange, AttendanceStatus, Id } from "@gestarahub/contracts";

/**
 * Rascunho da chamada no aparelho (12/11/2026): os toques ficam na tela ate o
 * "Salvar". Se o app fechar no meio (bateria, trocar de app no celular), a
 * proxima abertura da aula oferece continuar de onde parou. Um por pessoa e
 * aula; vence em 7 dias.
 */

/** Marcacao desejada por aluno; `null` = desmarcar. */
export type AttendanceDraft = ReadonlyMap<Id, AttendanceStatus | null>;

export interface StoredAttendanceDraft {
  changes: AttendanceChange[];
  savedAt: string;
}

const KEY_PREFIX = "gestarahub:attendance-draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function attendanceDraftKey(userId: Id, sessionId: Id): string {
  return `${KEY_PREFIX}:${userId}:${sessionId}`;
}

export function draftToChanges(draft: AttendanceDraft): AttendanceChange[] {
  return [...draft].map(([studentId, status]) => ({ studentId, status }));
}

/**
 * Rascunho que ainda muda alguma coisa: so alunos que seguem na aula e cuja
 * marcacao difere da que esta salva.
 */
export function pruneDraft(
  changes: AttendanceChange[],
  saved: ReadonlyMap<Id, AttendanceStatus | null>,
): Map<Id, AttendanceStatus | null> {
  const next = new Map<Id, AttendanceStatus | null>();
  for (const change of changes) {
    if (!saved.has(change.studentId)) continue;
    if ((saved.get(change.studentId) ?? null) === change.status) continue;
    next.set(change.studentId, change.status);
  }
  return next;
}

export function readStoredDraft(key: string, now = Date.now()): StoredAttendanceDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAttendanceDraft>;
    const savedAt = typeof parsed.savedAt === "string" ? Date.parse(parsed.savedAt) : NaN;
    if (!Array.isArray(parsed.changes) || Number.isNaN(savedAt) || now - savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    const changes = parsed.changes.filter(
      (c): c is AttendanceChange =>
        Boolean(c) &&
        typeof c.studentId === "string" &&
        (c.status === null || c.status === "present" || c.status === "absent" || c.status === "justified"),
    );
    return changes.length > 0 ? { changes, savedAt: parsed.savedAt as string } : null;
  } catch {
    return null;
  }
}

export function writeStoredDraft(key: string, draft: AttendanceDraft, now = new Date()): void {
  try {
    if (draft.size === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    const value: StoredAttendanceDraft = { changes: draftToChanges(draft), savedAt: now.toISOString() };
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem armazenamento (aba anonima, cota): a chamada segue so na tela.
  }
}

export function clearStoredDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // idem
  }
}
