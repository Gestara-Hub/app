import type { DocumentField, DocumentModel } from "@gestarahub/contracts";
import { documentDateTime } from "./format";

/**
 * Comprovante do pagamento online (/p/<codigo>) como `DocumentModel`: so dados
 * do pagamento e do espaco, nunca do aluno (o link e publico).
 */
export interface PaymentReceiptInput {
  code: string;
  organizationName: string;
  /** "Mensalidade", "Aula avulsa", "Curso Confeitaria"... */
  label: string;
  amountCents: number;
  paidAt?: string;
  methodLabel: string;
  /** Mes da mensalidade ("out/2026"). */
  competenceLabel?: string;
  /** Taxa repassada ao aluno: valor da cobranca e taxa somada. */
  breakdown?: { baseCents: number; feeCents: number };
  issuedAt: string;
}

export function paymentReceiptDocument(input: PaymentReceiptInput): DocumentModel {
  const reference = input.competenceLabel ? `${input.label} · ${input.competenceLabel}` : input.label;
  const items: DocumentField[] = [
    { label: "Valor pago", value: input.amountCents, format: "money", strong: true },
    { label: "Referente a", value: reference },
    ...(input.breakdown
      ? [
          { label: input.label, value: input.breakdown.baseCents, format: "money" as const },
          { label: "Taxa do pagamento online", value: input.breakdown.feeCents, format: "money" as const },
        ]
      : []),
    ...(input.paidAt ? [{ label: "Pago em", value: input.paidAt, format: "datetime" as const }] : []),
    { label: "Forma de pagamento", value: input.methodLabel },
    { label: "Recebedor", value: input.organizationName },
    { label: "Código do pagamento", value: input.code },
  ];
  return {
    fileName: `comprovante-${input.code}`,
    title: "Comprovante de pagamento",
    subtitle: "Pagamento confirmado.",
    header: { organizationName: input.organizationName },
    meta: [
      { label: "Código", value: input.code },
      {
        label: "Emitido em",
        value: documentDateTime(input.issuedAt),
      },
    ],
    blocks: [{ type: "fields", title: "Dados do pagamento", items }],
    footnote:
      "Comprovante emitido pelo GestaraHub a partir do registro do pagamento. Pagamento processado por um parceiro de pagamentos regulado. Não substitui nota fiscal.",
  };
}
