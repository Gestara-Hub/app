import type {
Id,RecurringAuthorization
} from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { format,parseISO } from "date-fns";
import {
notFoundError,
nowIso,persistLocal
} from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../auditLogService";
import { tenantHasFeature } from "../subscriptionService";
import { brDate, cancelOnlinePaymentsForCharge, chargeLabel, currentSettings, isOpen, studentName, todayISO } from "./onlinePaymentRules";

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
 * Pix Automatico: autorizacao ativa do aluno e baixa automatica das cobrancas.
 */

export function activeAuthorizationOf(
  studentId: Id,
): RecurringAuthorization | undefined {
  return store.recurringAuthorizations.find(
    (a) => a.studentId === studentId && a.status === "active",
  );
}

/**
 * Pix Automatico: com autorizacao ATIVA, as mensalidades em aberto do aluno com
 * vencimento entre a data da autorizacao e hoje (data local) e valor dentro do
 * limite sao pagas com
 * `paidVia = "recurring"` e `method = "pix"`. Acima do limite ficam em aberto
 * (a tela mostra o aviso). Chamado no inicio das leituras de cobranca
 * (Cobrancas e Financeiro). Idempotente; persiste quando muda algo.
 * Retorna quantas pagou.
 */
export function applyRecurringAutoPayments(): number {
  if (!tenantHasFeature("online_payments") || !currentSettings().enabled)
    return 0;
  const active = store.recurringAuthorizations.filter(
    (a) => a.status === "active",
  );
  if (active.length === 0) return 0;
  // Debita so o que vence a partir da autorizacao: o atraso de antes dela
  // continua em aberto (o aluno nao autorizou pagar o passado).
  const byStudent = new Map(
    active.map((a) => [
      a.studentId,
      {
        limit: a.maxAmountCents,
        since: a.authorizedAt ? format(parseISO(a.authorizedAt), "yyyy-MM-dd") : undefined,
      },
    ]),
  );
  const today = todayISO();
  let paid = 0;
  for (const c of store.charges) {
    if (c.kind !== "membership" || !isOpen(c) || c.dueDate > today) continue;
    const auth = byStudent.get(c.studentId);
    if (!auth || c.amountCents > auth.limit) continue;
    if (auth.since && c.dueDate < auth.since) continue;
    const ts = nowIso();
    c.status = "paid";
    c.paidAt = ts;
    c.method = "pix";
    c.paidVia = "recurring";
    c.updatedAt = ts;
    cancelOnlinePaymentsForCharge(c.id);
    auditLogService.record({
      action: "status_changed",
      target: { type: "charge", id: c.id, label: chargeLabel(c) },
      predicate: `registrou o débito do Pix Automático da ${chargeLabel(c)} (${formatCents(c.amountCents)}, vence ${brDate(c.dueDate)})`,
    });
    paid += 1;
  }
  if (paid > 0) persistLocal();
  return paid;
}

export function recurringLabel(studentId: Id): string {
  return `Pix Automático de ${studentName(studentId)}`;
}

export function findAuthorization(id: Id): RecurringAuthorization {
  const a = store.recurringAuthorizations.find((x) => x.id === id);
  if (!a) throw notFoundError("Autorização do Pix Automático não encontrada.");
  return a;
}
