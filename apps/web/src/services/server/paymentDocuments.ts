import type { Charge, Client, DocumentModel, Id, PaymentMethod, TeacherPayoutStatus } from "@gestarahub/contracts";
import { notFoundError, apiError } from "@gestarahub/core/api-error";
import { resolveOnlinePayer } from "@gestarahub/core/payer";
import { competenceLongLabel } from "@/lib/documents/format";
import {
  paymentRecordDocument,
  paymentsStatementDocument,
  teacherStatementDocument,
  type DocumentPayer,
} from "@/lib/documents/payment-documents";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { teacherPayServiceImpl } from "../finance";
import { runInWorld } from "../world/runWorld";
import { store } from "../world/store";
import { chargeLabelOf, competenceLabelOf } from "./paymentPage";
import type { TenantContext } from "./tenant";

/**
 * Recibo, declaracao anual e demonstrativo do professor, no servidor: leem o
 * espaco da sessao (runInWorld) e montam o `DocumentModel`. Quem chama confere
 * a permissao. Modulo so do servidor.
 */

const TIME_ZONE = "America/Sao_Paulo";

/** Ano do instante no horario do Brasil. */
function yearOf(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric" }).format(new Date(iso)));
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function organizationDetails(): string | undefined {
  return [store.unit?.name, store.unit?.phone].filter(Boolean).join(" · ") || undefined;
}

/** Quem paga: o pagador da cobranca online (com CPF) ou, sem CPF, o proprio aluno. */
function payerOf(student: Client): DocumentPayer {
  const result = resolveOnlinePayer(student, todayISO());
  if (result.ok) return { name: result.payer.name, cpf: result.payer.cpf };
  const guardian = student.guardians?.find((g) => g.financial) ?? student.guardians?.[0];
  return result.reason === "guardian_cpf_missing" && guardian?.name ? { name: guardian.name } : { name: student.name };
}

function methodLabelOf(charge: Charge): string | undefined {
  if (charge.paidVia === "online") return "Pagamento online";
  if (charge.method && (PAYMENT_METHODS as string[]).includes(charge.method)) {
    return paymentMethodLabel(charge.method as PaymentMethod);
  }
  return undefined;
}

function chargeReference(charge: Charge): { label: string; competenceLabel?: string } {
  return {
    label: chargeLabelOf(charge.kind, charge.description ?? null),
    competenceLabel: charge.kind === "membership" ? competenceLabelOf(charge.competence) : undefined,
  };
}

function studentOf(id: Id): Client {
  const student = store.clients.find((c) => c.id === id);
  if (!student) throw notFoundError("Aluno não encontrado.");
  return student;
}

/** Recibo de uma cobranca paga. */
export function buildPaymentRecord(ctx: TenantContext, chargeId: Id): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
    const charge = store.charges.find((c) => c.id === chargeId);
    if (!charge) throw notFoundError("Cobrança não encontrada.");
    if (charge.status !== "paid") {
      throw apiError("VALIDATION", "O recibo sai depois que a cobrança é paga.", { httpStatus: 422 });
    }
    const student = studentOf(charge.studentId);
    return paymentRecordDocument({
      chargeId: charge.id,
      organizationName: store.organization.name,
      organizationDetails: organizationDetails(),
      payer: payerOf(student),
      studentName: student.name,
      ...chargeReference(charge),
      amountCents: charge.amountCents,
      paidAt: charge.paidAt,
      methodLabel: methodLabelOf(charge),
      issuedAt: new Date().toISOString(),
    });
  });
}

/** Declaracao dos pagamentos do aluno no ano (pelo dia em que pagou). */
export function buildPaymentsStatement(ctx: TenantContext, studentId: Id, year: number): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
    const student = studentOf(studentId);
    const rows = store.charges
      .filter((c) => c.studentId === studentId && c.status === "paid" && c.paidAt && yearOf(c.paidAt) === year)
      .sort((a, b) => String(a.paidAt).localeCompare(String(b.paidAt)))
      .map((c) => {
        const reference = chargeReference(c);
        return {
          paidAt: String(c.paidAt),
          label: [reference.label, reference.competenceLabel].filter(Boolean).join(" · "),
          methodLabel: methodLabelOf(c),
          amountCents: c.amountCents,
        };
      });
    return paymentsStatementDocument({
      organizationName: store.organization.name,
      organizationDetails: organizationDetails(),
      studentName: student.name,
      payer: payerOf(student),
      year,
      rows,
      issuedAt: new Date().toISOString(),
      fileKey: student.id.slice(0, 8),
    });
  });
}

const PAYOUT_STATUS_LABEL: Record<TeacherPayoutStatus, string> = {
  open: "Em aberto",
  closed: "Fechado, a pagar",
  paid: "Pago",
  canceled: "Cancelado",
};

/** Demonstrativo do professor no mes (o mesmo detalhe da tela de pagamento). */
export function buildTeacherStatement(ctx: TenantContext, professionalId: Id, competence: string): Promise<DocumentModel> {
  return runInWorld(ctx, async () => {
    const detail = await teacherPayServiceImpl.getPayoutPreview(professionalId, competence);
    const payout = detail.payout;
    return teacherStatementDocument({
      organizationName: store.organization.name,
      organizationDetails: organizationDetails(),
      professionalName: detail.professionalName,
      competence,
      competenceLabel: competenceLongLabel(competence),
      statusLabel: PAYOUT_STATUS_LABEL[detail.status],
      ruleSummary: detail.ruleSummary,
      dueDate: detail.dueDate,
      paidAt: payout?.paidAt,
      methodLabel: payout?.method ? paymentMethodLabel(payout.method) : undefined,
      lines: detail.lines,
      totalCents: detail.totalCents,
      sessions: detail.sessions.map((s) => ({
        date: s.date,
        start: s.start,
        className: s.className,
        substituting: s.primaryInstructorId !== professionalId ? s.primaryInstructorName : undefined,
      })),
      issuedAt: new Date().toISOString(),
      fileKey: professionalId.slice(0, 8),
    });
  });
}
