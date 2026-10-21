import type {
  Charge,
  Client,
  DateISO,
  Id,
  StudentAttendanceWindow,
  StudentCourseInstallments,
  StudentEnrollmentState,
  StudentOpenBalance,
  StudentPackageView,
  StudentScholarship,
  StudentSummary,
  StudentSummaryEnrollment,
  StudentSummaryLevel,
  StudentSummaryMembership,
} from "@gestarahub/contracts";
import { classBillingMode, isCourseEnded } from "@gestarahub/core/billing";
import { packageState } from "@gestarahub/core/packages";
import { addDays, format, parseISO } from "date-fns";
import { daysUntilBirthday } from "@/lib/birthdays";
import { getSegmentPreset, vocabularyForModality } from "@/lib/business-segment-presets";
import {
  ageAt,
  currentLevelOf,
  isAgedOutOfLevel,
  resolveModalityTrack,
  resolveTrackStyle,
} from "@/lib/progression-tracks";
import { store } from "@/services/world/store";
import { notFoundError, readOp } from "@/services/world/ops";
import { ensureMembershipCharges } from "./billingService";
import { applyRecurringAutoPayments } from "./onlinePaymentsService";
import { delegateAll } from "./world/delegate";

/**
 * Resumo do aluno (ficha do aluno, doc 22 item 2): a leitura unica que a API
 * vai expor para a ficha e os apps. Composta so do que o store ja guarda.
 */

const ATTENDANCE_WINDOW_DAYS = 30;
const LAST_RECORDS = 3;
const LAST_MESSAGES = 5;

function todayISO(): DateISO {
  return format(new Date(), "yyyy-MM-dd");
}

/** Data LOCAL de um timestamp ISO. */
function localDateOf(iso: string): DateISO {
  return format(parseISO(iso), "yyyy-MM-dd");
}

/** Em aberto: pendente ou atrasada (o atraso e derivado do vencimento). */
const isOpen = (c: Charge) => c.status === "pending" || c.status === "overdue";

function activeScholarship(client: Client, today: DateISO): StudentScholarship | undefined {
  const d = client.discount;
  if (!d?.scholarship) return undefined;
  if (d.validUntil && d.validUntil < today) return undefined;
  return { percent: d.value, full: d.value >= 100, reason: d.reason, validUntil: d.validUntil };
}

/** Valor do plano com o desconto ou bolsa vigente (mesma conta da lista de alunos). */
function effectivePrice(client: Client, listPriceCents: number, today: DateISO): number {
  const d = client.discount;
  if (!d || d.value <= 0 || (d.validUntil && d.validUntil < today)) return listPriceCents;
  const off = d.type === "percentage" ? Math.round((listPriceCents * d.value) / 100) : Math.round(d.value);
  return Math.max(0, listPriceCents - off);
}

function membershipOf(client: Client, today: DateISO): StudentSummaryMembership {
  const plan = client.planId ? store.plans.find((p) => p.id === client.planId) : undefined;
  const scholarship = activeScholarship(client, today);
  return {
    planId: plan?.id,
    planName: plan?.name ?? (scholarship?.full ? "Bolsa integral" : undefined),
    planPeriod: plan?.period,
    listPriceCents: plan?.priceCents,
    priceCents: plan ? effectivePrice(client, plan.priceCents, today) : undefined,
    status: client.membershipStatus ?? "active",
    paymentTiming: client.cyclePaymentTiming,
    billingStrategy: client.billingStrategy,
    dueDay: client.dueDay,
    scholarship,
    recurringActive: store.recurringAuthorizations.some(
      (a) => a.studentId === client.id && a.status === "active",
    ),
  };
}

function openBalanceOf(charges: Charge[], today: DateISO): StudentOpenBalance {
  const balance: StudentOpenBalance = { totalCents: 0, count: 0, overdueCents: 0, overdueCount: 0 };
  for (const c of charges) {
    if (!isOpen(c)) continue;
    balance.totalCents += c.amountCents;
    balance.count += 1;
    if (c.dueDate < today) {
      balance.overdueCents += c.amountCents;
      balance.overdueCount += 1;
    }
  }
  return balance;
}

/** Presencas do aluno por aula (`turma~data~inicio`). */
function attendancesOf(studentId: Id) {
  return store.attendances
    .filter((a) => a.studentId === studentId)
    .map((a) => {
      const [classGroupId, date] = a.sessionId.split("~");
      return { classGroupId, date, status: a.status };
    });
}

function courseInstallmentsOf(
  enrollmentId: Id,
  charges: Charge[],
  course: { priceCents: number; installments: number },
  today: DateISO,
): StudentCourseInstallments {
  const out: StudentCourseInstallments = {
    priceCents: course.priceCents,
    installments: course.installments,
    paid: 0,
    paidCents: 0,
    open: 0,
    openCents: 0,
    overdue: 0,
  };
  for (const c of charges) {
    if (c.kind !== "course" || c.enrollmentId !== enrollmentId) continue;
    if (c.status === "paid") {
      out.paid += 1;
      out.paidCents += c.amountCents;
    } else if (isOpen(c)) {
      out.open += 1;
      out.openCents += c.amountCents;
      if (c.dueDate < today) out.overdue += 1;
    }
  }
  return out;
}

const STATE_ORDER: Record<StudentEnrollmentState, number> = {
  active: 0,
  paused: 1,
  completed: 2,
  canceled: 3,
};

function enrollmentsOf(
  studentId: Id,
  charges: Charge[],
  attendances: ReturnType<typeof attendancesOf>,
  today: DateISO,
): StudentSummaryEnrollment[] {
  const rows: StudentSummaryEnrollment[] = [];
  for (const e of store.enrollments) {
    if (e.studentId !== studentId) continue;
    const g = store.classGroups.find((x) => x.id === e.classGroupId);
    if (!g) continue;
    const state: StudentEnrollmentState =
      e.status === "canceled"
        ? "canceled"
        : e.status === "active" && isCourseEnded(g, today)
          ? "completed"
          : e.status;
    let present = 0;
    let absent = 0;
    for (const a of attendances) {
      if (a.classGroupId !== g.id) continue;
      if (a.status === "present") present += 1;
      else if (a.status === "absent") absent += 1;
    }
    rows.push({
      id: e.id,
      classGroupId: g.id,
      className: g.name,
      modalityId: g.modalityId,
      modalityName: g.modalityId ? store.categories.find((c) => c.id === g.modalityId)?.name : undefined,
      instructorName: store.professionals.find((p) => p.id === g.instructorId)?.name ?? "",
      // Aluno de pacote em turma de mensalidade aparece como pacote.
      billingMode: e.paysWithPackage && classBillingMode(g) === "membership" ? "package" : classBillingMode(g),
      state,
      enrolledAt: e.enrolledAt,
      canceledAt: e.canceledAt,
      endDate: g.endDate,
      presentCount: present,
      absentCount: absent,
      attendanceRate: present + absent > 0 ? present / (present + absent) : null,
      course: e.course ? courseInstallmentsOf(e.id, charges, e.course, today) : undefined,
    });
  }
  return rows.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.enrolledAt.localeCompare(a.enrolledAt) ||
      a.className.localeCompare(b.className, "pt-BR"),
  );
}

function attendanceWindow(
  attendances: ReturnType<typeof attendancesOf>,
  today: DateISO,
): StudentAttendanceWindow {
  const from = format(addDays(parseISO(today), -(ATTENDANCE_WINDOW_DAYS - 1)), "yyyy-MM-dd");
  const window: StudentAttendanceWindow = {
    days: ATTENDANCE_WINDOW_DAYS,
    present: 0,
    absent: 0,
    justified: 0,
    rate: null,
  };
  for (const a of attendances) {
    if (!a.date || a.date < from || a.date > today) continue;
    window[a.status] += 1;
  }
  const counted = window.present + window.absent;
  window.rate = counted > 0 ? window.present / counted : null;
  return window;
}

/**
 * Nivel por modalidade com trilha ligada: as matriculadas (matricula ativa) e
 * as que ja tem progresso salvo. Palavras da trilha da modalidade, com as da
 * area como reserva.
 */
function levelsOf(client: Client, enrollments: StudentSummaryEnrollment[], today: DateISO): StudentSummaryLevel[] {
  const org = store.organization;
  const areaWords = getSegmentPreset(
    org.classSegment,
    org.customSegmentProgression,
    org.customSegmentBilling,
  ).vocabulary;
  const enrolled = new Set(
    enrollments.filter((e) => e.state === "active" || e.state === "paused").map((e) => e.modalityId),
  );
  const modalityIds = [
    ...new Set([...enrolled].filter((id): id is Id => Boolean(id)).concat(Object.keys(client.progressions ?? {}))),
  ];
  const age = ageAt(client.birthDate, today);
  const levels: StudentSummaryLevel[] = [];
  for (const modalityId of modalityIds) {
    const modality = store.categories.find((c) => c.id === modalityId);
    if (!modality) continue;
    const track = resolveModalityTrack(modality);
    if (!track.enabled || track.levels.length === 0) continue;
    const progression = client.progressions?.[modalityId];
    const level = currentLevelOf(track, progression, age);
    if (!level) continue;
    const words = vocabularyForModality(modality, areaWords);
    const records = [...(progression?.evaluations ?? [])].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    levels.push({
      modalityId,
      modalityName: modality.name,
      isEnrolled: enrolled.has(modalityId),
      levelName: level.name,
      levelColor: level.color,
      subLevel: progression?.subLevel ?? 0,
      maxSubLevels: level.maxSubLevels,
      trackStyle: resolveTrackStyle(track),
      promotedAt: progression?.promotedAt,
      agedOut: isAgedOutOfLevel(level, age),
      lastAdvancedAt: [...(progression?.promotionHistory ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.date,
      words: { level: words.level, levelsTitle: words.levelsTitle, promotion: words.promotion },
      lastRecords: records.slice(0, LAST_RECORDS),
      recordsCount: records.length,
      openGoals: (progression?.goals ?? []).filter((g) => !g.completedAt).length,
    });
  }
  return levels.sort(
    (a, b) =>
      Number(b.isEnrolled) - Number(a.isEnrolled) ||
      Number(Boolean(b.promotedAt)) - Number(Boolean(a.promotedAt)) ||
      a.modalityName.localeCompare(b.modalityName, "pt-BR"),
  );
}

/** Pacotes em uso do aluno (como na lista de pacotes): o que vence primeiro antes. */
function activePackagesOf(client: Client, today: DateISO): StudentPackageView[] {
  return store.studentPackages
    .filter((p) => p.studentId === client.id && p.status === "active")
    .map((p) => ({
      ...p,
      studentName: client.name,
      ...packageState(p, today),
      modalityNames: p.modalityIds
        .map((id) => store.categories.find((c) => c.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
      classNames: (p.classGroupIds ?? [])
        .map((id) => store.classGroups.find((g) => g.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    }))
    .sort(
      (a, b) =>
        (a.expiresAt ?? "9999-12-31").localeCompare(b.expiresAt ?? "9999-12-31") ||
        b.purchasedAt.localeCompare(a.purchasedAt),
    );
}

export const studentSummaryServiceImpl = {
  getStudentSummary(studentId: Id): Promise<StudentSummary> {
    return readOp(async () => {
      const client = store.clients.find((c) => c.id === studentId);
      if (!client) throw notFoundError("Aluno não encontrado.");
      // Mesma leitura de Cobranças: mensalidades do mes nascem e o Pix Automatico paga.
      await ensureMembershipCharges();
      applyRecurringAutoPayments();

      const today = todayISO();
      const charges = store.charges.filter((c) => c.studentId === studentId);
      const attendances = attendancesOf(studentId);
      const enrollments = enrollmentsOf(studentId, charges, attendances, today);
      const lastMessages = (store.messageLogs ?? [])
        .filter((m) => m.clientId === studentId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .slice(0, LAST_MESSAGES);

      return structuredClone({
        student: client,
        age: ageAt(client.birthDate, today),
        daysToBirthday: client.birthDate ? daysUntilBirthday(client.birthDate, today) : null,
        studentSince: localDateOf(client.createdAt),
        membership: membershipOf(client, today),
        enrollments,
        openBalance: openBalanceOf(charges, today),
        attendance30d: attendanceWindow(attendances, today),
        levels: levelsOf(client, enrollments, today),
        packages: activePackagesOf(client, today),
        lastMessages,
      });
    });
  },
};

/** Conta real no navegador: roda no servidor sobre o banco (doc 15, fatia 2). */
export const studentSummaryService = delegateAll("studentSummary", studentSummaryServiceImpl);
