import type { ChargeView, Id, MessageTrigger, ReminderSources } from "@gestarahub/contracts";
import { format, subDays } from "date-fns";
import { can } from "@/lib/permissions";
import { getCurrentActor } from "@/services/world/actor";
import { readOp } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { chargesService } from "../billing/chargesService";
import { studentPackagesService } from "../billing/studentPackagesService";
import { attendanceService } from "../classes/attendanceService";
import { levelsOf } from "../clients/studentSummaryRules";
import { actorTeacherId } from "../classes/teacherScope";
import { ensureLogs, ensureTemplates } from "./communicationRules";
import { dateInSpace } from "@gestarahub/core/date";

/**
 * Dados dos lembretes (doc product/25) numa leitura so: alunos ativos,
 * cobrancas em aberto e pagas ha pouco, pacotes, faltas seguidas, mensagens
 * recentes e os prazos dos modelos. A regra do que lembrar e pura, no app.
 */

/** Tipos de mensagem que tem lembrete (o que ja foi enviado tira o lembrete). */
export const REMINDER_TRIGGERS: MessageTrigger[] = [
  "billing_before_due",
  "billing_due_date",
  "billing_after_due",
  "billing_critical",
  "charge_reminder",
  "package_ending",
  "absence_alert",
  "birthday_greeting",
  "welcome_student",
  "level_up",
  "payment_received",
];

/** Mensagens consideradas (atraso volta a lembrar depois de 7 dias; 60 cobre a semana do aniversario e o pacote). */
const LOG_WINDOW_DAYS = 60;
const PAID_WINDOW_DAYS = 7;
/** "Parabéns pelo avanço" ate 14 dias depois (o mesmo da ficha). */
const PROMOTION_WINDOW_DAYS = 14;

export const remindersService = {
  getReminderSources(): Promise<ReminderSources> {
    return readOp(async () => {
      const actor = getCurrentActor();
      const teacherId = actorTeacherId();
      const canBilling = teacherId === undefined && (!actor || can(actor.profile, "billing:view"));

      // Professor: so os alunos das turmas em que e o titular.
      const teacherStudents =
        teacherId === undefined
          ? undefined
          : new Set(
              store.enrollments
                .filter(
                  (e) =>
                    e.status === "active" &&
                    store.classGroups.some((g) => g.id === e.classGroupId && g.instructorId === teacherId),
                )
                .map((e) => e.studentId),
            );
      const visible = (studentId: Id) => !teacherStudents || teacherStudents.has(studentId);

      const students = store.clients
        .filter((c) => c.status === "active" && visible(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          ...(c.phone ? { phone: c.phone } : {}),
          ...(c.birthDate ? { birthDate: c.birthDate } : {}),
          createdAt: c.createdAt,
        }));
      const active = new Set(students.map((s) => s.id));

      const paidSince = subDays(new Date(), PAID_WINDOW_DAYS).toISOString();
      const charges: ChargeView[] = canBilling
        ? (await chargesService.listCharges()).filter(
            (c) =>
              active.has(c.studentId) &&
              c.kind !== "dropin" &&
              (c.status === "pending" ||
                c.status === "overdue" ||
                (c.status === "paid" && Boolean(c.paidAt) && String(c.paidAt) >= paidSince)),
          )
        : [];
      const packages = canBilling
        ? (await studentPackagesService.listStudentPackages()).filter((p) => active.has(p.studentId))
        : [];
      const absenceStreaks = (await attendanceService.listAbsenceStreaks(3)).filter((s) => active.has(s.studentId));

      // Avanco de nivel registrado ha pouco (graduacao), para o "Parabéns pelo avanço".
      const today = dateInSpace();
      const promotedSince = format(subDays(new Date(), PROMOTION_WINDOW_DAYS), "yyyy-MM-dd");
      const promotions = store.clients
        .filter((c) => active.has(c.id) && c.progressions && Object.keys(c.progressions).length > 0)
        .flatMap((c) =>
          levelsOf(c, [], today)
            .filter((l) => l.lastAdvancedAt && l.lastAdvancedAt >= promotedSince)
            .map((l) => ({
              studentId: c.id,
              modalityId: l.modalityId,
              modalityName: l.modalityName,
              levelName: l.levelName,
              subLevel: l.subLevel,
              trackStyle: l.trackStyle,
              lastAdvancedAt: l.lastAdvancedAt as string,
            })),
        );

      const since = subDays(new Date(), LOG_WINDOW_DAYS).toISOString();
      const triggers = new Set(REMINDER_TRIGGERS);
      const logs = ensureLogs()
        .filter((l) => triggers.has(l.trigger) && l.sentAt >= since && (!l.clientId || active.has(l.clientId)))
        .map((l) => ({
          trigger: l.trigger,
          ...(l.clientId ? { clientId: l.clientId } : {}),
          ...(l.chargeId ? { chargeId: l.chargeId } : {}),
          sentAt: l.sentAt,
        }));
      const templates = ensureTemplates()
        .filter((t) => triggers.has(t.trigger))
        .map((t) => ({ trigger: t.trigger, enabled: t.enabled, daysOffset: t.daysOffset }));

      return { canBilling, students, charges, packages, absenceStreaks, promotions, logs, templates };
    });
  },
};
