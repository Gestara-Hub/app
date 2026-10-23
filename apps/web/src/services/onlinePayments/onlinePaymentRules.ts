import type {
ApiErrorField,
Charge,
Id,
OnlinePayment,
OnlinePaymentMethod,
OnlinePaymentSettings,
PaymentMethod
} from "@gestarahub/contracts";
import { describeCharge } from "@gestarahub/core/billing";
import {
availableOnlineMethods
} from "@gestarahub/core/payment-fees";
import { format } from "date-fns";
import {
apiError,notFoundError,
nowIso,validationError
} from "@/services/world/ops";
import { store } from "@/services/world/store";
import { realAccountInBrowser } from "../world/delegate";
import { afterWorldCommit } from "../world/effects";
import {
cancelGatewayPaymentsAction,
cancelOnlinePaymentsForChargeInDb
} from "../onlinePaymentsBackend";

/**
 * Pagamento online SIMULADO (docs/technical/05, secao 6): Pix, link de
 * pagamento e Pix Automatico aplicados as cobrancas dos alunos. O provedor fica
 * atras de `paymentGateway` (mock, sem rede). Mutations exigem o recurso
 * "online_payments" do plano; cobrar exige tambem a opcao ligada nas
 * Configuracoes.
 *
 * Decisoes desta implementacao:
 * - Link pago vira `method = "card"` (pagina de link costuma ser cartao); Pix
 *   vira `method = "pix"`. Ambos com `paidVia = "online"`.
 * - Gerar um novo Pix/link cancela o que estava em aberto da mesma cobranca
 *   (um codigo valido por vez).
 * - Pix Automatico so processa com o recurso no plano E a opcao ligada.
 */

/**
 * Regras e apoio do pagamento online no mundo do espaco: configuracao, cobranca em aberto, codigo publico, formas aceitas e cancelamento.
 */

/** Validade padrao do Pix (24 h). */
export const DEFAULT_PIX_EXPIRES_IN_MINUTES = 1440;

export const MIN_EXPIRES_IN_MINUTES = 5;

export const MAX_EXPIRES_IN_MINUTES = 43_200; // 30 dias

export const PIX_KEY_MAX_LENGTH = 77;

/** Contexto do dialogo "Cobrar online" (read-model desta tela). */
export interface OnlineChargeCheckout {
  chargeId: Id;
  studentId: Id;
  studentName: string;
  studentPhone?: string;
  amountCents: number;
  dueDate: string;
  /** Mais recente primeiro. */
  payments: OnlinePayment[];
}

export type UpdateOnlinePaymentSettings = Partial<OnlinePaymentSettings>;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Data LOCAL de hoje (nao UTC). */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function brDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}

export function chargeLabel(c: Charge): string {
  return describeCharge(c, studentName(c.studentId));
}

export function isOpen(c: Charge): boolean {
  return c.status === "pending" || c.status === "overdue";
}

/** Configuracao do tenant ativo com os padroes preenchidos. */
export function currentSettings(): OnlinePaymentSettings & {
  defaultExpiresInMinutes: number;
} {
  const s = store.organization.settings?.onlinePayments;
  return {
    enabled: Boolean(s?.enabled),
    pixKey: s?.pixKey,
    defaultExpiresInMinutes:
      s?.defaultExpiresInMinutes ?? DEFAULT_PIX_EXPIRES_IN_MINUTES,
    // Antes estes campos ficavam de fora: o repasse padrao por meio e as
    // tarifas da subconta nunca chegavam ao calculo da cobranca.
    passFeeToCustomer: s?.passFeeToCustomer,
    passFeePix: s?.passFeePix,
    passFeeCard: s?.passFeeCard,
    passFeeBoleto: s?.passFeeBoleto,
    passFeeChoice: s?.passFeeChoice,
    acceptedMethods: s?.acceptedMethods,
    gatewayFees: s?.gatewayFees,
  };
}

export function assertOnlineEnabled(): void {
  if (!currentSettings().enabled) {
    throw apiError(
      "VALIDATION",
      "A cobrança online está desligada. Ligue em Configurações → Pagamento online.",
      { httpStatus: 409 },
    );
  }
}

export function findOpenCharge(chargeId: Id): Charge {
  const c = store.charges.find((x) => x.id === chargeId);
  if (!c) throw notFoundError("Cobrança não encontrada.");
  if (!isOpen(c)) {
    throw apiError(
      "VALIDATION",
      "Só é possível cobrar online uma cobrança pendente ou atrasada.",
      { httpStatus: 409 },
    );
  }
  return c;
}

/**
 * `awaiting` com validade passada vira `expired`. Retorna se mudou algo. So na
 * demonstracao: na conta real quem expira (e exclui no Asaas) e o servidor
 * (`expireDueOnlinePayments`), e o navegador so le o status do banco.
 */
/**
 * Codigo do endereco publico /p/<codigo> (pagina do Pix ou ida ao link): 10
 * caracteres aleatorios, sem os que se confundem (0/O, 1/l): 56^10 combinacoes.
 * `getRandomValues` funciona tambem fora de HTTPS (ao contrario do randomUUID).
 */
export const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function newPublicCode(): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PUBLIC_CODE_ALPHABET[b % PUBLIC_CODE_ALPHABET.length]).join("");
}

export function expireStale(): boolean {
  if (realAccountInBrowser()) return false;
  const now = nowIso();
  let changed = false;
  for (const p of store.onlinePayments) {
    if (p.status === "awaiting" && p.expiresAt <= now) {
      p.status = "expired";
      changed = true;
    }
  }
  return changed;
}

export function paymentsOf(chargeId: Id): OnlinePayment[] {
  return store.onlinePayments
    .filter((p) => p.chargeId === chargeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function methodLabel(method: OnlinePaymentMethod): string {
  switch (method) {
    case "pix":
      return "Pix";
    case "link":
      return "link de cartão";
    case "boleto":
      return "boleto";
    default:
      return "link com Pix, boleto ou cartão";
  }
}

/** Forma de pagamento gravada na cobranca (ver decisoes no topo). Boleto e "o aluno escolhe" sem o meio confirmado: outro. */
export function chargeMethodFor(method: OnlinePaymentMethod): PaymentMethod {
  return method === "link" ? "card" : method === "pix" ? "pix" : "other";
}

/** A forma precisa estar entre as aceitas pelo espaco (Recebimentos online). */
export function assertMethodAccepted(method: OnlinePaymentMethod, settings: OnlinePaymentSettings): void {
  if (!availableOnlineMethods(settings).includes(method)) {
    throw apiError(
      "VALIDATION",
      method === "choice"
        ? "\"O aluno escolhe\" exige Pix, cartão e boleto ligados em Recebimentos online."
        : "Esta forma de pagamento está desligada em Recebimentos online.",
      { httpStatus: 422 },
    );
  }
}

/**
 * Cancela os pagamentos online em aberto da cobranca (pagar manual, cancelar a
 * cobranca, gerar um novo codigo). Uso interno de services, dentro da escrita
 * deles. Retorna quantos cancelou.
 */
export function cancelOnlinePaymentsForCharge(chargeId: Id, reason?: string): number {
  let count = 0;
  const canceled: Id[] = [];
  for (const p of store.onlinePayments) {
    if (p.chargeId === chargeId && p.status === "awaiting") {
      p.status = "canceled";
      if (reason) p.canceledReason = reason;
      count += 1;
      canceled.push(p.id);
    }
  }
  // No servidor (doc 15, fatia 2) o cancelamento vai para o banco junto com o
  // resto da operacao; o Asaas e avisado depois que a gravacao der certo.
  if (canceled.length > 0 && afterWorldCommit(() => cancelGatewayPaymentsAction(canceled))) {
    return count;
  }
  // Conta real: cancela tambem no banco e no Asaas (troca de plano, inativacao,
  // saida da aula...), para o aluno nao pagar um link antigo. Sem esperar: quem
  // chama esta no meio da propria escrita; erro fica no log e o Asaas e
  // retentado depois. Repetir para a mesma cobranca nao tem efeito.
  if (realAccountInBrowser()) {
    void cancelOnlinePaymentsForChargeInDb(chargeId, store.organization.id, reason).catch((err) =>
      console.error("[onlinePaymentsService] Erro ao cancelar a cobrança online no banco e no Asaas:", err),
    );
  }
  return count;
}

export function validateSettings(next: OnlinePaymentSettings): void {
  const fields: ApiErrorField[] = [];
  const minutes = next.defaultExpiresInMinutes;
  if (
    minutes !== undefined &&
    (!Number.isInteger(minutes) ||
      minutes < MIN_EXPIRES_IN_MINUTES ||
      minutes > MAX_EXPIRES_IN_MINUTES)
  ) {
    fields.push({
      field: "defaultExpiresInMinutes",
      message: "Informe uma validade entre 5 minutos e 30 dias.",
    });
  }
  if (next.pixKey && next.pixKey.length > PIX_KEY_MAX_LENGTH) {
    fields.push({
      field: "pixKey",
      message: `A chave Pix tem no máximo ${PIX_KEY_MAX_LENGTH} caracteres.`,
    });
  }
  const accepted = next.acceptedMethods;
  if (accepted && !accepted.pix && !accepted.card && !accepted.boleto) {
    fields.push({ field: "acceptedMethods", message: "Deixe ao menos uma forma de pagamento ligada." });
  }
  if (fields.length > 0) throw validationError(fields);
}
