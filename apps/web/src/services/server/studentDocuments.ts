import type { Client, DocumentModel, Id } from "@gestarahub/contracts";
import { notFoundError } from "@gestarahub/core/api-error";
import { formatAverage, formatGrade } from "@gestarahub/core/grades";
import { onlineFundsLabel, onlinePaymentMethodLabel } from "@gestarahub/core/payment-fees";
import { getSegmentPreset } from "@/lib/business-segment-presets";
import { competenceLongLabel, documentDate, unitHeaderLine } from "@/lib/documents/format";
import { onlineStatementDocument } from "@/lib/documents/payment-documents";
import { minorConsentDocument, reportCardDocument } from "@/lib/documents/student-documents";
import { gradesServiceImpl } from "../grades";
import { runInWorld } from "../world/runWorld";
import { documentSlices } from "./documentSlices";
import { store } from "../world/store";
import { chargeLabelOf, competenceLabelOf } from "./paymentPage";
import type { TenantContext } from "./tenant";
import { currentSpaceTimeZone } from "@gestarahub/core/date";

/**
 * Termo do responsavel, boletim do aluno e extrato da conta de recebimento,
 * no servidor (runInWorld). Quem chama confere a permissao. Modulo so do servidor.
 */


function organizationDetails(): string | undefined {
  return unitHeaderLine(store.unit);
}

function studentOf(id: Id): Client {
  const student = store.clients.find((c) => c.id === id);
  if (!student) throw notFoundError("Aluno não encontrado.");
  return student;
}

/** Termo de autorizacao do responsavel (aluno menor), em branco ou com a autorizacao registrada. */
export function buildMinorConsent(ctx: TenantContext, studentId: Id): Promise<DocumentModel> {
  return runInWorld(ctx, () => minorConsentModel(studentId), { fn: documentSlices.minorConsent, args: [studentId] });
}

/** O documento sobre o espaco ja carregado (o recorte e conferido nos testes). */
export async function minorConsentModel(studentId: Id): Promise<DocumentModel> {
  const student = studentOf(studentId);
  const guardian = student.guardians?.find((g) => g.financial) ?? student.guardians?.[0];
  const status = student.minorConsentStatus;
  return minorConsentDocument({
    organizationName: store.organization.name,
    organizationDetails: organizationDetails(),
    studentName: student.name,
    birthDate: student.birthDate,
    guardian: guardian ? { name: guardian.name, relationship: guardian.relationship, phone: guardian.phone } : undefined,
    confirmed:
      status === "confirmed_whatsapp"
        ? { method: "online", at: student.minorConsentAt, by: student.minorConsentBy }
        : status === "confirmed_paper"
          ? { method: "paper", at: student.minorConsentAt, by: student.minorConsentBy }
          : undefined,
    issuedAt: new Date().toISOString(),
    fileKey: student.id.slice(0, 8),
  });
}

/** Boletim: trilha atual, notas por modalidade e historico de avancos. */
export function buildReportCard(ctx: TenantContext, studentId: Id): Promise<DocumentModel> {
  return runInWorld(ctx, () => reportCardModel(studentId), { fn: documentSlices.reportCard, args: [studentId] });
}

/** O documento sobre o espaco ja carregado (o recorte e conferido nos testes). */
export async function reportCardModel(studentId: Id): Promise<DocumentModel> {
  const student = studentOf(studentId);
  const card = await gradesServiceImpl.getReportCard(studentId);
  const org = store.organization;
  const area = getSegmentPreset(org.classSegment, org.customSegmentProgression, org.customSegmentBilling).vocabulary;
  const modalityName = (id: Id, fallback?: string) =>
    store.categories.find((c) => c.id === id)?.name ?? fallback ?? "Modalidade";
  const levelText = (name: string, subLevel?: number) => (subLevel && subLevel > 0 ? `${name} · ${subLevel}º grau` : name);
  const progressions = Object.values(student.progressions ?? {});
  return reportCardDocument({
    organizationName: org.name,
    organizationDetails: organizationDetails(),
    studentName: student.name,
    currentLevels: progressions
      .filter((p) => p.levelName)
      .map((p) => ({
        modalityName: modalityName(p.modalityId, p.modalityName),
        label: levelText(p.levelName, p.subLevel),
        since: p.promotedAt,
      })),
    modalities: card.modalities.map((m) => ({
      modalityName: m.modalityName,
      summary: [
        m.overall ? `Média geral ${formatAverage(m.settings.scale, m.overall)}` : "Sem média ainda",
        m.settings.scale === "pass_fail" ? null : `aprovação a partir de ${formatGrade(m.settings.scale, m.settings.passingGrade)}`,
      ]
        .filter(Boolean)
        .join(" · ")
        .concat("."),
      rows: m.entries.map((e) => ({
        date: e.date,
        name: e.name,
        className: e.classGroupName,
        levelName: e.levelName,
        weight: e.weight,
        grade:
          e.status === "absent"
            ? "Faltou"
            : e.status === "graded" && e.value !== undefined
              ? formatGrade(m.settings.scale, e.value)
              : undefined,
        tone: e.status === "absent" ? "muted" : e.belowPassing ? "negative" : "default",
      })),
    })),
    promotions: progressions
      .flatMap((p) =>
        p.promotionHistory.map((h) => ({
          date: h.date,
          modalityName: modalityName(p.modalityId, p.modalityName),
          from: h.fromLevelName ? levelText(h.fromLevelName, h.fromSubLevel) : undefined,
          to: levelText(h.toLevelName, h.toSubLevel),
          by: h.examiner,
        })),
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    levelLabel: area.level,
    promotionLabel: area.promotion,
    issuedAt: new Date().toISOString(),
    fileKey: student.id.slice(0, 8),
  });
}

/** "2026-10" do instante, no fuso do espaco. */
function competenceOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: currentSpaceTimeZone() }).slice(0, 7);
}

/** Extrato dos pagamentos online confirmados no mes (valor, taxas, liquido e saldo). */
export function buildOnlineStatement(ctx: TenantContext, competence: string): Promise<DocumentModel> {
  return runInWorld(ctx, () => onlineStatementModel(competence), { fn: documentSlices.onlineStatement, args: [competence] });
}

/** O documento sobre o espaco ja carregado (o recorte e conferido nos testes). */
export async function onlineStatementModel(competence: string): Promise<DocumentModel> {
  const rows = store.onlinePayments
    .filter((p) => p.status === "paid" && p.paidAt && competenceOf(p.paidAt) === competence)
    .sort((a, b) => String(a.paidAt).localeCompare(String(b.paidAt)))
    .map((p) => {
      const charge = store.charges.find((c) => c.id === p.chargeId);
      const student = charge ? store.clients.find((c) => c.id === charge.studentId) : undefined;
      const fee =
        p.netAmountCents !== undefined
          ? Math.max(0, p.amountCents - p.netAmountCents)
          : (p.gatewayFeeCents ?? 0) + (p.splitAmountCents ?? 0);
      const label = charge
        ? [chargeLabelOf(charge.kind, charge.description ?? null), charge.kind === "membership" ? competenceLabelOf(charge.competence) : undefined]
            .filter(Boolean)
            .join(" · ")
        : "Cobrança";
      return {
        paidAt: String(p.paidAt),
        studentName: student?.name ?? "—",
        label,
        methodLabel: onlinePaymentMethodLabel(p.method, p.paidMethod),
        amountCents: p.amountCents,
        feeCents: fee,
        netCents: p.netAmountCents ?? p.amountCents - fee,
        availability: onlineFundsLabel(p.fundsReleased !== false, p.creditDate, documentDate),
      };
    });
  return onlineStatementDocument({
    organizationName: store.organization.name,
    organizationDetails: organizationDetails(),
    competence,
    competenceLabel: competenceLongLabel(competence),
    rows,
    issuedAt: new Date().toISOString(),
  });
}
