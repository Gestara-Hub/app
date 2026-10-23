import type { DocumentField, DocumentModel, DocumentTableRow } from "@gestarahub/contracts";
import { formatCpf } from "@gestarahub/core/payer";
import { displayCell, documentDateTime } from "./format";

/**
 * Documentos de pagamento no layout unico: recibo de uma cobranca paga,
 * declaracao anual de pagamentos do aluno e demonstrativo do professor.
 * Funcoes puras; os dados chegam prontos do servidor.
 */

export interface DocumentPayer {
  name: string;
  cpf?: string;
}

/** "Maria Souza (CPF 123.456.789-00)". */
function payerText(payer: DocumentPayer): string {
  return payer.cpf ? `${payer.name} (CPF ${formatCpf(payer.cpf)})` : payer.name;
}

export interface PaymentRecordInput {
  chargeId: string;
  organizationName: string;
  /** "Unidade Centro · Lutas". */
  organizationDetails?: string;
  payer: DocumentPayer;
  studentName: string;
  label: string;
  competenceLabel?: string;
  amountCents: number;
  paidAt?: string;
  methodLabel?: string;
  issuedAt: string;
}

/** Numero curto do recibo (o comeco do id da cobranca, em maiusculas). */
export function receiptNumber(chargeId: string): string {
  return chargeId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Recibo de uma cobranca paga no espaco (dinheiro, Pix direto, cartao na maquininha). */
export function paymentRecordDocument(input: PaymentRecordInput): DocumentModel {
  const number = receiptNumber(input.chargeId);
  const reference = [input.label, input.competenceLabel].filter(Boolean).join(" · ");
  const items: DocumentField[] = [
    { label: "Valor", value: input.amountCents, format: "money", strong: true },
    { label: "Referente a", value: reference },
    ...(input.payer.name !== input.studentName ? [{ label: "Aluno", value: input.studentName }] : []),
    { label: "Pago em", value: input.paidAt, format: "datetime" },
    { label: "Forma de pagamento", value: input.methodLabel },
    { label: "Recebedor", value: input.organizationName },
  ];
  return {
    fileName: `recibo-${number}`,
    title: "Recibo de pagamento",
    subtitle: `Recibo nº ${number}`,
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [
      { label: "Recibo", value: number },
      { label: "Emitido em", value: documentDateTime(input.issuedAt) },
    ],
    blocks: [
      {
        type: "text",
        text: `Recebemos de ${payerText(input.payer)} a quantia de ${displayCell(input.amountCents, "money")}, referente a ${input.label}${input.competenceLabel ? ` de ${input.competenceLabel}` : ""}.`,
      },
      { type: "fields", title: "Dados do pagamento", items },
      { type: "signatures", lines: [input.organizationName] },
    ],
    footnote: "Recibo emitido pelo GestaraHub a partir do pagamento registrado pelo espaço. Não substitui nota fiscal.",
  };
}

export interface PaymentsStatementRow {
  paidAt: string;
  label: string;
  methodLabel?: string;
  amountCents: number;
}

export interface PaymentsStatementInput {
  organizationName: string;
  organizationDetails?: string;
  studentName: string;
  payer: DocumentPayer;
  year: number;
  rows: PaymentsStatementRow[];
  issuedAt: string;
  fileKey: string;
}

/** Declaracao anual de pagamentos (imposto de renda, reembolso, comprovacao). */
export function paymentsStatementDocument(input: PaymentsStatementInput): DocumentModel {
  const totalCents = input.rows.reduce((sum, row) => sum + row.amountCents, 0);
  const forStudent = input.payer.name !== input.studentName ? `, referentes ao aluno ${input.studentName},` : "";
  return {
    fileName: `declaracao-pagamentos-${input.fileKey}-${input.year}`,
    title: `Declaração de pagamentos ${input.year}`,
    subtitle: input.studentName,
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [
      { label: "Ano", value: String(input.year) },
      { label: "Emitido em", value: documentDateTime(input.issuedAt) },
    ],
    blocks: [
      {
        type: "text",
        text:
          input.rows.length > 0
            ? `Declaramos que recebemos de ${payerText(input.payer)}${forStudent} os pagamentos abaixo, no total de ${displayCell(totalCents, "money")}, no ano de ${input.year}.`
            : `Não há pagamentos registrados de ${input.studentName} no ano de ${input.year}.`,
      },
      {
        type: "table",
        columns: [
          { key: "paidAt", label: "Pago em", format: "date", width: 1 },
          { key: "label", label: "Referente a", width: 2.6 },
          { key: "method", label: "Forma", width: 1.2 },
          { key: "amount", label: "Valor", format: "money", width: 1.1 },
        ],
        rows: input.rows.map((row) => ({
          cells: { paidAt: row.paidAt, label: row.label, method: row.methodLabel, amount: row.amountCents },
        })),
        totals: { label: "Total", amount: totalCents },
        emptyText: "Nenhum pagamento neste ano.",
      },
      { type: "signatures", lines: [input.organizationName] },
    ],
    footnote: "Valores pagos ao espaço no ano, conforme os registros do GestaraHub. Não substitui nota fiscal.",
  };
}

export interface TeacherStatementLine {
  label: string;
  quantity?: number;
  baseCents?: number;
  amountCents: number;
}

export interface TeacherStatementSession {
  date: string;
  start: string;
  className: string;
  /** Titular da turma, quando o professor deu a aula no lugar dele. */
  substituting?: string;
}

export interface TeacherStatementInput {
  organizationName: string;
  organizationDetails?: string;
  professionalName: string;
  competence: string;
  competenceLabel: string;
  statusLabel: string;
  ruleSummary?: string;
  dueDate: string;
  paidAt?: string;
  methodLabel?: string;
  lines: TeacherStatementLine[];
  totalCents: number;
  sessions: TeacherStatementSession[];
  issuedAt: string;
  fileKey: string;
}

/** Demonstrativo do pagamento do professor no mes (calculo, ajustes e aulas contadas). */
export function teacherStatementDocument(input: TeacherStatementInput): DocumentModel {
  const lineRows: DocumentTableRow[] = input.lines.map((line) => ({
    cells: { label: line.label, quantity: line.quantity, base: line.baseCents, amount: line.amountCents },
    tones: { amount: line.amountCents < 0 ? "negative" : "default" },
  }));
  return {
    fileName: `demonstrativo-${input.fileKey}-${input.competence}`,
    title: "Demonstrativo de pagamento",
    subtitle: `${input.professionalName} · ${input.competenceLabel}`,
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [
      { label: "Mês trabalhado", value: input.competenceLabel },
      { label: "Emitido em", value: documentDateTime(input.issuedAt) },
    ],
    blocks: [
      {
        type: "fields",
        title: "Resumo",
        items: [
          { label: "Professor", value: input.professionalName },
          ...(input.ruleSummary ? [{ label: "Regra", value: input.ruleSummary }] : []),
          { label: "Situação", value: input.statusLabel },
          { label: "Vencimento", value: input.dueDate, format: "date" },
          ...(input.paidAt
            ? [
                { label: "Pago em", value: input.paidAt, format: "date" as const },
                { label: "Forma de pagamento", value: input.methodLabel },
              ]
            : []),
          { label: "Total", value: input.totalCents, format: "money", strong: true },
        ],
      },
      {
        type: "table",
        title: "Cálculo",
        columns: [
          { key: "label", label: "Descrição", width: 3 },
          { key: "quantity", label: "Qtd.", format: "integer", width: 0.7 },
          { key: "base", label: "Base", format: "money", width: 1.1 },
          { key: "amount", label: "Valor", format: "money", width: 1.1 },
        ],
        rows: lineRows,
        totals: { label: "Total", amount: input.totalCents },
        emptyText: "Nada a receber neste mês.",
      },
      {
        type: "table",
        title: "Aulas contadas",
        numbered: true,
        columns: [
          { key: "date", label: "Data", format: "date", width: 1 },
          { key: "start", label: "Horário", width: 0.8 },
          { key: "className", label: "Turma", width: 2.4 },
          { key: "note", label: "Observação", width: 1.8 },
        ],
        rows: input.sessions.map((session) => ({
          cells: {
            date: session.date,
            start: session.start,
            className: session.className,
            note: session.substituting ? `No lugar de ${session.substituting}` : undefined,
          },
        })),
        emptyText: "Nenhuma aula contada neste mês.",
      },
      { type: "signatures", lines: [input.professionalName, input.organizationName] },
    ],
  };
}

export interface OnlineStatementRow {
  paidAt: string;
  studentName: string;
  label: string;
  methodLabel: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  /** "Disponível" ou "Libera em 21/11/2026" (cartao). */
  availability: string;
}

export interface OnlineStatementInput {
  organizationName: string;
  organizationDetails?: string;
  competence: string;
  competenceLabel: string;
  rows: OnlineStatementRow[];
  issuedAt: string;
}

/** Extrato da conta de recebimento: pagamentos online do mes, taxas e liquido. */
export function onlineStatementDocument(input: OnlineStatementInput): DocumentModel {
  const sum = (pick: (row: OnlineStatementRow) => number) => input.rows.reduce((total, row) => total + pick(row), 0);
  const paid = sum((r) => r.amountCents);
  const fees = sum((r) => r.feeCents);
  const net = sum((r) => r.netCents);
  return {
    fileName: `extrato-recebimentos-online-${input.competence}`,
    title: "Extrato de recebimentos online",
    subtitle: `Pagamentos confirmados em ${input.competenceLabel.toLowerCase()}.`,
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [
      { label: "Período", value: input.competenceLabel },
      { label: "Emitido em", value: documentDateTime(input.issuedAt) },
    ],
    landscape: true,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Pagamentos", value: input.rows.length, format: "integer" },
          { label: "Recebido", value: paid, format: "money" },
          { label: "Taxas", value: fees, format: "money", tone: fees > 0 ? "negative" : "default" },
          { label: "Líquido", value: net, format: "money", tone: "positive" },
        ],
      },
      {
        type: "table",
        columns: [
          { key: "paidAt", label: "Pago em", format: "datetime", width: 1.2 },
          { key: "student", label: "Aluno", width: 1.7 },
          { key: "label", label: "Referente a", width: 1.7 },
          { key: "method", label: "Forma", width: 1 },
          { key: "amount", label: "Valor", format: "money" },
          { key: "fee", label: "Taxas", format: "money" },
          { key: "net", label: "Líquido", format: "money" },
          { key: "availability", label: "Saldo", width: 1.3 },
        ],
        rows: input.rows.map((r) => ({
          cells: {
            paidAt: r.paidAt,
            student: r.studentName,
            label: r.label,
            method: r.methodLabel,
            amount: r.amountCents,
            fee: r.feeCents,
            net: r.netCents,
            availability: r.availability,
          },
          tones: { fee: r.feeCents > 0 ? "negative" : "default", net: "positive" },
        })),
        totals: { student: "Total", amount: paid, fee: fees, net },
        emptyText: "Nenhum pagamento online neste mês.",
      },
    ],
    footnote: "Valores do parceiro de pagamentos regulado. Taxas incluem a tarifa do parceiro e a do GestaraHub.",
  };
}
