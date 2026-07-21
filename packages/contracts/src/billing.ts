import type { DateISO, DateTimeISO, Id, RecordStatus } from "./common";

/**
 * Modelo 3 — Fatia 2 (financeiro). Registro/status apenas, SEM gateway de
 * pagamento (coerente com o mock). Decisoes (docs/product/11): cobranca CHEIA
 * (sem pro-rata); matricula pausada/cancelada nao gera cobranca; turma fixa =
 * mensalidade (plano), drop-in = cobranca avulsa.
 */

/** Plano de mensalidade (catalogo). */
export interface Plano {
  id: Id;
  organizationId: Id;
  name: string;
  priceCents: number;
  period: "monthly"; // MVP: mensal
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreatePlano = Omit<Plano, "id" | "createdAt" | "updatedAt">;
export type UpdatePlano = Partial<CreatePlano>;

export interface PlanoFilter {
  search?: string;
  status?: RecordStatus;
}

/** Cobranca de um aluno (mensalidade recorrente ou avulsa de aula). */
export type CobrancaKind = "mensalidade" | "avulsa";
export type CobrancaStatus = "pending" | "paid" | "overdue" | "canceled";
export type PaymentMethod = "dinheiro" | "pix" | "cartao" | "outro";

export interface Cobranca {
  id: Id;
  organizationId: Id;
  studentId: Id;
  kind: CobrancaKind;
  planId?: Id; // mensalidade
  classGroupId?: Id;
  competencia?: string; // "YYYY-MM" (mensalidade)
  sessionId?: Id; // avulsa (aula reservada)
  dueDate: DateISO;
  amountCents: number; // cobranca cheia (sem pro-rata)
  status: CobrancaStatus;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface CobrancaFilter {
  competencia?: string;
  status?: CobrancaStatus;
  studentId?: Id;
}

export interface CobrancaView extends Cobranca {
  studentName: string;
  planName?: string;
  className?: string;
}
