import type { Client, DocumentModel, Id, OnlinePayment } from "@gestarahub/contracts";
import { notFoundError } from "@gestarahub/core/api-error";
import { formatAverage, formatGrade } from "@gestarahub/core/grades";
import { getSegmentPreset } from "@/lib/business-segment-presets";
import { competenceLongLabel, documentDate } from "@/lib/documents/format";
import { onlineStatementDocument } from "@/lib/documents/payment-documents";
import { minorConsentDocument, reportCardDocument } from "@/lib/documents/student-documents";
import { gradesServiceImpl } from "../grades";
import { runInWorld } from "../world/runWorld";
import { store } from "../world/store";
import { chargeLabelOf, competenceLabelOf } from "./paymentPage";
import type { TenantContext } from "./tenant";

/**
 * Termo do responsavel, boletim do aluno e extrato da conta de recebimento,
 * no servidor (runInWorld). Quem chama confere a permissao. Modulo so do servidor.
 */

const TIME_ZONE = "America/Sao_Paulo";

function organizationDetails(): string | undefined {
  return [store.unit?.name, store.unit?.phone].filter(Boolean).join(" · ") || undefined;
}

function studentOf(id: Id): Client {
  const student = store.clients.find((c) => c.id === id);
  if (!student) throw notFoundError("Aluno não encontrado.");
  return student;
}

/** Termo de autorizacao do responsavel (aluno menor), em branco ou com a autorizacao registrada. */
export function buildMinorConsent(ctx: TenantContext, studentId: Id): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
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
  });
}

/** Boletim: trilha atual, notas por modalidade e historico de avancos. */
export function buildReportCard(ctx: TenantContext, studentId: Id): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
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
  });
}

const PAID_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  creditCard: "Cartão de crédito",
  debitCard: "Cartão de débito",
};

function methodLabelOf(payment: OnlinePayment): string {
  if (payment.paidMethod) return PAID_METHOD_LABEL[payment.paidMethod] ?? "Pagamento online";
  return payment.method === "pix" ? "Pix" : payment.method === "boleto" ? "Boleto" : "Pagamento online";
}

/** "2026-10" do instante, no horario do Brasil. */
function competenceOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE }).slice(0, 7);
}

/** Extrato dos pagamentos online confirmados no mes (valor, taxas, liquido e saldo). */
export function buildOnlineStatement(ctx: TenantContext, competence: string): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
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
          methodLabel: methodLabelOf(p),
          amountCents: p.amountCents,
          feeCents: fee,
          netCents: p.netAmountCents ?? p.amountCents - fee,
          availability: p.fundsReleased === false && p.creditDate ? `Libera em ${documentDate(p.creditDate)}` : "Disponível",
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
  });
}
