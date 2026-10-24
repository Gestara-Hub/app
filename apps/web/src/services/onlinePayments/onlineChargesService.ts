import type { Id, OnlinePayment, OnlinePaymentMethod } from "@gestarahub/contracts";
import {
  ASAAS_BILLING_TYPE,
  calculateOnlineChargeAmounts,
  defaultPassFeeFor,
  effectiveGatewayFees,
  platformSplitCents,
} from "@gestarahub/core/payment-fees";
import { formatCents } from "@gestarahub/core/format";
import { payerIssueMessage, payerIssueOf, resolveOnlinePayer } from "@gestarahub/core/payer";
import { apiError, newId, notFoundError, nowIso, readOp, writeOp, persistLocal } from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../audit/auditLogService";
import { paymentGateway } from "../payments/paymentGateway";
import { assertFeature } from "../subscription/subscriptionService";
import { realAccountInBrowser } from "../world/delegate";
import { isSupabaseOrganization } from "@/lib/session";
import {
  cancelOnlinePaymentsForChargeInDb,
  insertOnlinePaymentInDb,
  listOnlinePaymentsForChargeFromDb,
  simulateOnlinePaidAction,
} from "./actions";
import {
  clone,
  todayISO,
  brDate,
  chargeLabel,
  currentSettings,
  assertOnlineEnabled,
  findOpenCharge,
  newPublicCode,
  expireStale,
  paymentsOf,
  methodLabel,
  chargeMethodFor,
  assertMethodAccepted,
  cancelOnlinePaymentsForCharge,
} from "./onlinePaymentRules";
import { payerRequired, type OnlineChargeCheckout } from "./onlinePaymentRules";
import { logError } from "@/lib/log";

/** Pix e link de uma cobranca: listar, gerar, simular o pago e cancelar. */
export const onlineChargesService = {
  // --- Cobranca online (Pix / link) -------------------------------------------
  listForCharge(chargeId: Id): Promise<OnlinePayment[]> {
    return readOp(() => {
      if (expireStale()) persistLocal();
      return clone(paymentsOf(chargeId));
    });
  },
  /** Codigos em aberto do espaco (Pix ou link ainda valido), para o lembrete levar o link. */
  listAwaiting(): Promise<OnlinePayment[]> {
    return readOp(() => {
      const now = nowIso();
      return clone(store.onlinePayments.filter((p) => p.status === "awaiting" && p.expiresAt > now));
    });
  },
  /** Dados do dialogo "Cobrar online": aluno, telefone e os pagamentos da cobranca. */
  getCheckout(chargeId: Id): Promise<OnlineChargeCheckout> {
    return readOp(async () => {
      if (expireStale()) persistLocal();
      const c = store.charges.find((x) => x.id === chargeId);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      const student = store.clients.find((s) => s.id === c.studentId);
      let payments = paymentsOf(c.id);

      if (realAccountInBrowser()) {
        const dbPayments = await listOnlinePaymentsForChargeFromDb(
          c.id,
          store.organization.id,
        );
        if (dbPayments.length > 0) {
          payments = dbPayments;
        }
      }

      return clone({
        chargeId: c.id,
        studentId: c.studentId,
        studentName: student?.name ?? "",
        studentPhone: student?.phone || undefined,
        amountCents: c.amountCents,
        dueDate: c.dueDate,
        payments,
        payerIssue: payerRequired() ? payerIssueOf(student ? resolveOnlinePayer(student, todayISO()) : null) : undefined,
      });
    });
  },
  /**
   * Gera um Pix ou link para a cobranca em aberto. Validade: a padrao das
   * Configuracoes (1440 min). Cancela o codigo anterior ainda em aberto.
   */
  async createForCharge(
    chargeId: Id,
    method: OnlinePaymentMethod,
    passFeeOverride?: boolean,
  ): Promise<OnlinePayment> {
    assertFeature("online_payments");
    assertOnlineEnabled();
    const charge = findOpenCharge(chargeId);
    const settings = currentSettings();
    const student = store.clients.find((s) => s.id === charge.studentId);
    const plan = charge.planId
      ? store.plans.find((p) => p.id === charge.planId)
      : undefined;
    const expiresInMinutes = settings.defaultExpiresInMinutes || 1440;

    assertMethodAccepted(method, settings);
    // Quem paga (doc 19): aluno maior com o proprio CPF; menor, o responsavel
    // financeiro. O parceiro exige o CPF: conta real sem ele nao gera o codigo.
    const payerResult = student ? resolveOnlinePayer(student, todayISO()) : null;
    const payer = payerResult?.ok ? payerResult.payer : undefined;
    if (!payer && payerRequired()) {
      throw apiError("VALIDATION", payerIssueMessage(payerIssueOf(payerResult) ?? "student_cpf_missing"), { httpStatus: 422 });
    }
    // Repasse: o da modal; sem ele, o padrao da forma em Recebimentos online.
    const passFee = passFeeOverride !== undefined ? passFeeOverride : defaultPassFeeFor(settings, method);

    // Taxa do GestaraHub por plano e tarifa do Asaas por meio (doc 19 §4, decisao A).
    const splitAmountCents = platformSplitCents(store.organization.subscription?.tier);
    const { chargedAmountCents, netAmountCents, gatewayFeeCents } = calculateOnlineChargeAmounts({
      amountCents: charge.amountCents,
      method,
      splitAmountCents,
      passFee,
      // Tarifas da subconta (promocao pela data); sem elas, a reserva do core.
      fees: effectiveGatewayFees(settings.gatewayFees, todayISO()),
    });

    // Conta real nunca recebe codigo de demonstracao; o servidor do e2e (E2E_NOW) roda sem Asaas.
    const gatewayOptions = { allowDemo: !isSupabaseOrganization(store.organization.id) || Boolean(process.env.E2E_NOW) };
    const provided =
      method === "pix"
        ? await paymentGateway.createPix({
            chargeId,
            amountCents: chargedAmountCents,
            splitAmountCents,
            expiresInMinutes,
            pixKey: settings.pixKey,
            merchantName: store.organization.name,
            studentId: charge.studentId,
            studentName: payer?.name ?? student?.name,
            studentCpf: payer?.cpf,
            studentPhone: payer?.phone ?? student?.phone,
            studentEmail: payer?.email ?? student?.email,
            studentAddress: student?.address,
            chargeDueDate: charge.dueDate,
            competence: charge.competence,
            planName: plan?.name,
            chargeKind: charge.kind,
            description: charge.description,
          }, gatewayOptions)
        : await paymentGateway.createLink({
            billingType: ASAAS_BILLING_TYPE[method] as "CREDIT_CARD" | "BOLETO" | "UNDEFINED",
            chargeId,
            amountCents: chargedAmountCents,
            splitAmountCents,
            expiresInMinutes,
            merchantName: store.organization.name,
            studentId: charge.studentId,
            studentName: payer?.name ?? student?.name,
            studentCpf: payer?.cpf,
            studentPhone: payer?.phone ?? student?.phone,
            studentEmail: payer?.email ?? student?.email,
            studentAddress: student?.address,
            chargeDueDate: charge.dueDate,
            competence: charge.competence,
            planName: plan?.name,
            chargeKind: charge.kind,
            description: charge.description,
          }, gatewayOptions);

    // Conta real nunca entrega codigo de demonstracao ao aluno: avisa o motivo.
    const gatewayProvider = provided.provider ?? "mock";
    // O servidor do e2e (E2E_NOW) roda sem Asaas e aceita o codigo simulado.
    if (gatewayProvider === "mock" && !gatewayOptions.allowDemo) {
      throw apiError(
        "NETWORK",
        `Não foi possível gerar ${method === "pix" ? "o Pix" : "o link"} no Asaas. ${provided.fallbackReason ?? ""}`.trim(),
        { httpStatus: 502 },
      );
    }

    return writeOp(async () => {
      // Revalida: a cobranca pode ter mudado durante a chamada ao provedor.
      const c = findOpenCharge(chargeId);
      cancelOnlinePaymentsForCharge(c.id, "Substituído por novo código");
      const payment: OnlinePayment = {
        id: newId(),
        organizationId: store.organization.id,
        chargeId: c.id,
        method,
        amountCents: chargedAmountCents,
        status: "awaiting",
        gatewayProvider,
        gatewayPaymentId: provided.providerId,
        splitAmountCents:
          "splitAmountCents" in provided ? provided.splitAmountCents : splitAmountCents,
        gatewayFeeCents,
        netAmountCents,
        feePassedToCustomer: passFee,
        ...("pixCopyPaste" in provided
          ? {
              pixCopyPaste: provided.pixCopyPaste,
            }
          : {}),
        ...("linkUrl" in provided ? { linkUrl: provided.linkUrl } : {}),
        publicCode: newPublicCode(),
        expiresAt: provided.expiresAt,
        createdAt: nowIso(),
      };

      if (realAccountInBrowser()) {
        try {
          await cancelOnlinePaymentsForChargeInDb(
            c.id,
            store.organization.id,
            "Substituído por novo código",
          );
          await insertOnlinePaymentInDb(payment, c.studentId);
        } catch (dbErr) {
          logError("[onlinePaymentsService] Erro ao salvar online_payment no banco:", dbErr);
        }
      }

      store.onlinePayments.push(payment);
      auditLogService.record({
        action: "created",
        target: {
          type: "online_payment",
          id: payment.id,
          label: chargeLabel(c),
        },
        predicate: `gerou a cobrança online por ${methodLabel(method)} da ${chargeLabel(c)} (${formatCents(c.amountCents)})`,
      });
      return clone(payment);
    });
  },
  /**
   * Demonstracao: o aluno "pagou". Marca o pagamento online e a cobranca como
   * pagos (`paidVia = "online"`); os demais codigos em aberto sao cancelados.
   */
  simulatePaid(onlinePaymentId: Id): Promise<OnlinePayment> {
    return writeOp(async () => {
      assertFeature("online_payments");

      if (realAccountInBrowser()) {
        const result = await simulateOnlinePaidAction(onlinePaymentId);
        if (!result.ok && result.reason === "gateway_refused") {
          throw apiError("CONFLICT", "O parceiro de pagamentos recusou a baixa. A cobrança continua em aberto.", {
            httpStatus: 409,
          });
        }
        if (!result.ok) {
          throw notFoundError("Pagamento online não encontrado no banco.");
        }
        // Sincroniza o store local para os seletores que dependem dele
        const localPayment = store.onlinePayments.find((p) => p.id === onlinePaymentId);
        if (localPayment) {
          localPayment.status = "paid";
          localPayment.paidAt = result.payment.paidAt;
        }
        const localCharge = store.charges.find((c) => c.id === result.chargeId);
        if (localCharge) {
          localCharge.status = "paid";
          localCharge.paidAt = result.payment.paidAt;
          localCharge.method = result.payment.method === "link" ? "card" : "pix";
          localCharge.paidVia = "online";
        }
        return result.payment;
      }

      expireStale();
      const payment = store.onlinePayments.find(
        (p) => p.id === onlinePaymentId,
      );
      if (!payment) throw notFoundError("Pagamento online não encontrado.");
      if (payment.status !== "awaiting") {
        throw apiError(
          "VALIDATION",
          payment.status === "expired"
            ? "Este código expirou. Gere um novo para cobrar."
            : "Este pagamento online não está mais em aberto.",
          { httpStatus: 409 },
        );
      }
      const charge = findOpenCharge(payment.chargeId);
      const ts = nowIso();
      cancelOnlinePaymentsForCharge(charge.id);
      payment.status = "paid";
      payment.paidAt = ts;
      charge.status = "paid";
      charge.paidAt = ts;
      charge.method = chargeMethodFor(payment.method);
      charge.paidVia = "online";
      charge.updatedAt = ts;
      auditLogService.record({
        action: "status_changed",
        target: {
          type: "online_payment",
          id: payment.id,
          label: chargeLabel(charge),
        },
        predicate: `registrou o pagamento online por ${methodLabel(payment.method)} (demonstração) da ${chargeLabel(charge)} (${formatCents(charge.amountCents)}, vence ${brDate(charge.dueDate)})`,
      });
      return clone(payment);
    });
  },
  /** Cancela os codigos em aberto da cobranca (uso raro; o normal e interno). */
  cancelForCharge(chargeId: Id): Promise<{ canceled: number }> {
    return writeOp(() => {
      assertFeature("online_payments");
      return { canceled: cancelOnlinePaymentsForCharge(chargeId) };
    });
  },
};
