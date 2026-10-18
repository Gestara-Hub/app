import type { DateISO, DateTimeISO, Id, RecordStatus, TenantScopeFields } from "./common";

/**
 * Pacote de aulas (doc 20, fase C). O espaco cadastra os pacotes (como os
 * planos) e vende ao aluno: a venda gera as cobrancas (`ChargeKind` "package")
 * e um `StudentPackage` com o saldo. A chamada gasta uma aula por presenca (e
 * por falta sem justificativa, se o pacote mandar); falta justificada nunca.
 */

/** Pacote do catalogo do espaco ("10 aulas de pilates", "Pacote 8 aulas"). */
export interface LessonPackage {
  id: Id;
  organizationId: Id;
  name: string;
  /** Quantidade de aulas (1 a 200). */
  lessons: number;
  priceCents: number;
  /** Validade em dias a partir da compra (1 a 730). Ausente = sem validade. */
  validityDays?: number;
  /**
   * Turmas em que vale (decisao de 18/10/2026). Vazio ou ausente = todas as
   * turmas de pacote e de mensalidade; turma sem cobranca e curso nunca.
   */
  classGroupIds?: Id[];
  /** Dado antigo: modalidades em que vale (vazio = todas). Novos pacotes usam `classGroupIds`. */
  modalityIds: Id[];
  /** Falta sem justificativa gasta a aula (padrao: sim). */
  absenceConsumes: boolean;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateLessonPackage = Omit<LessonPackage, "id" | "createdAt" | "updatedAt" | TenantScopeFields>;
export type UpdateLessonPackage = Partial<CreateLessonPackage>;

export interface LessonPackageFilter {
  search?: string;
  status?: RecordStatus;
}

/**
 * `active`: em uso (pode estar vencido ou sem saldo, derivado na leitura);
 * `renewed`: o saldo passou para um pacote novo (regra 6); `canceled`: venda
 * desfeita antes de usar qualquer aula.
 */
export type StudentPackageStatus = "active" | "renewed" | "canceled";

/** Por que a aula foi gasta: presenca ou falta sem justificativa. */
export type PackageUsageReason = "present" | "absent";

/** Uma aula gasta do pacote: uma por (aluno x aula), refeita a cada chamada. */
export interface PackageUsage {
  sessionId: Id;
  classGroupId: Id;
  date: DateISO;
  reason: PackageUsageReason;
}

/**
 * Aulas trazidas de outro pacote na renovacao: o pacote que VENDEU essas aulas
 * (a origem, mesmo depois de varias renovacoes) e quantas. Guarda o valor de
 * cada aula para o repasse do professor (preco da origem / aulas compradas
 * nela; doc 20, decisao 7).
 */
export interface CarriedLessons {
  fromPackageId: Id;
  lessons: number;
}

/** Pacote comprado pelo aluno: copia o pacote do catalogo na hora da venda. */
export interface StudentPackage {
  id: Id;
  organizationId: Id;
  unitId?: Id;
  studentId: Id;
  packageId: Id;
  name: string;
  /** Aulas do pacote + saldo trazido do pacote anterior. */
  lessonsTotal: number;
  /** Sempre igual a `usages.length`. */
  lessonsUsed: number;
  purchasedAt: DateISO;
  /** Ultimo dia em que as aulas valem. Ausente = sem validade. */
  expiresAt?: DateISO;
  /** Turmas em que vale, copiadas do catalogo na venda (vazio = todas). */
  classGroupIds?: Id[];
  modalityIds: Id[];
  absenceConsumes: boolean;
  status: StudentPackageStatus;
  /** Saldo trazido do pacote anterior (renovacao, regra 6). */
  carriedOverLessons?: number;
  /**
   * De onde vieram as aulas trazidas (soma = `carriedOverLessons`). Ausente em
   * dado antigo: vale como trazido do `renewedFromId`.
   */
  carriedFrom?: CarriedLessons[];
  /** Pacote anterior cujo saldo veio para este. */
  renewedFromId?: Id;
  /** Pacote novo que recebeu o saldo deste (status "renewed"). */
  renewedIntoId?: Id;
  chargeIds: Id[];
  usages: PackageUsage[];
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface StudentPackageFilter {
  studentId?: Id;
  status?: StudentPackageStatus;
}

/** Leitura com o saldo e os avisos derivados de hoje. */
export interface StudentPackageView extends StudentPackage {
  studentName: string;
  /** Aulas que ainda podem ser usadas (0 se renovado, cancelado ou vencido). */
  remaining: number;
  isExpired: boolean;
  isUsedUp: boolean;
  /** Resta uma aula (e nao venceu). */
  isLastLesson: boolean;
  /** Vence em ate 7 dias (com saldo e ainda valido). */
  expiresSoon: boolean;
  /** Dias ate o vencimento (0 = vence hoje). So com validade. */
  daysToExpire?: number;
  /** Nomes das modalidades (vazio = todas). */
  modalityNames: string[];
  /** Nomes das turmas em que vale (vazio = todas de pacote e de mensalidade). */
  classNames: string[];
}

/** Venda de um pacote ao aluno. Valor ajustavel (unico desconto), 1 a 12 parcelas. */
export interface SellPackage {
  studentId: Id;
  packageId: Id;
  priceCents: number;
  installments: number;
  firstDueDate: DateISO;
}
