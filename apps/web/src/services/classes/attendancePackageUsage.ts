import type { AttendanceStatus, ClassGroup, DateISO, Id } from "@gestarahub/contracts";
import { format, parseISO } from "date-fns";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { hasPackageUsage, syncPackageUsage } from "../billing";
import { studentName, parseSessionId } from "./classShared";
import { buildRoster, paysWithPackage } from "./classViews";

/**
 * Acerta o pacote do aluno com a chamada desta aula (gasta, troca o motivo ou
 * devolve). `status` ausente = presenca desmarcada.
 */
export function syncAttendanceUsage(sessionId: Id, studentId: Id, status?: AttendanceStatus) {
  const p = parseSessionId(sessionId);
  const g = p ? store.classGroups.find((x) => x.id === p.classGroupId) : undefined;
  if (!p || !g) return "none" as const;
  const kind = buildRoster(g, sessionId, p.date).find((r) => r.studentId === studentId)?.kind;
  // Aula que ja gastou pacote segue no pacote mesmo depois de o aluno passar
  // a pagar com mensalidade (remarcar nao devolve a aula; desmarcar devolve).
  const byPackage = paysWithPackage(g, kind, studentId) || hasPackageUsage(studentId, sessionId);
  return syncPackageUsage({
    studentId,
    sessionId,
    classGroupId: g.id,
    modalityId: g.modalityId,
    date: p.date,
    status: byPackage ? status : undefined,
  });
}

const ATTENDANCE_WORD: Record<AttendanceStatus, string> = {
  present: "presença",
  absent: "falta",
  justified: "falta justificada",
};

/**
 * Chamada so entra na Auditoria quando mexe no pacote (gasta ou devolve
 * aula): marcar presenca o dia todo encheria o registro.
 */
export function auditPackageUsage(
  usage: ReturnType<typeof syncAttendanceUsage>,
  g: ClassGroup,
  date: DateISO,
  studentId: Id,
  status?: AttendanceStatus,
) {
  if (usage !== "added" && usage !== "reverted") return;
  const name = studentName(studentId);
  const mark = status ? ATTENDANCE_WORD[status] : "chamada desfeita";
  const when = `${mark} em ${g.name}, ${format(parseISO(date), "dd/MM")}`;
  auditLogService.record({
    action: "updated",
    target: { type: "client", id: studentId, label: name },
    predicate:
      usage === "added"
        ? `descontou 1 aula do pacote de ${name} (${when})`
        : `devolveu 1 aula ao pacote de ${name} (${when})`,
  });
}
