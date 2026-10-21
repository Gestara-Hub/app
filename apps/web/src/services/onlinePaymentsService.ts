import type {
  ApiErrorField,
  Charge,
  Id,
  OnlinePayment,
  OnlinePaymentMethod,
  OnlinePaymentSettings,
  PaymentMethod,
  RecurringAuthorization,
} from "@gestarahub/contracts";
import { describeCharge } from "@gestarahub/core/billing";
import { calculateOnlineChargeAmounts, platformSplitCents } from "@gestarahub/core/payment-fees";
import { formatCents } from "@gestarahub/core/format";
import { format, parseISO } from "date-fns";
import {
  apiError,
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  validationError,
} from "@/mocks/helpers";
import { persist, store } from "@/mocks/store";
import { auditLogService } from "./auditLogService";
import { paymentGateway } from "./payments/paymentGateway";
import { assertFeature, tenantHasFeature } from "./subscriptionService";
import { isSupabaseOrganization } from "@/lib/session";
import {
  cancelOnlinePaymentsForChargeInDb,
  insertOnlinePaymentInDb,
  listOnlinePaymentsForChargeFromDb,
  simulateOnlinePaidAction,
  updateOrganizationOnlineSettingsAction,
} from "./onlinePaymentsBackend";

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

/** Validade padrao do Pix (24 h). */
export const DEFAULT_PIX_EXPIRES_IN_MINUTES = 1440;
const MIN_EXPIRES_IN_MINUTES = 5;
const MAX_EXPIRES_IN_MINUTES = 43_200; // 30 dias
const PIX_KEY_MAX_LENGTH = 77;

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

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Data LOCAL de hoje (nao UTC). */
function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function brDate(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function studentName(id: Id): string {
  return store.clients.find((c) => c.id === id)?.name ?? "";
}

function chargeLabel(c: Charge): string {
  return describeCharge(c, studentName(c.studentId));
}

function isOpen(c: Charge): boolean {
  return c.status === "pending" || c.status === "overdue";
}

/** Configuracao do tenant ativo com os padroes preenchidos. */
function currentSettings(): OnlinePaymentSettings & {
  defaultExpiresInMinutes: number;
} {
  const s = store.organization.settings?.onlinePayments;
  return {
    enabled: Boolean(s?.enabled),
    pixKey: s?.pixKey,
    defaultExpiresInMinutes:
      s?.defaultExpiresInMinutes ?? DEFAULT_PIX_EXPIRES_IN_MINUTES,
  };
}

function assertOnlineEnabled(): void {
  if (!currentSettings().enabled) {
    throw apiError(
      "VALIDATION",
      "A cobrança online está desligada. Ligue em Configurações → Pagamento online.",
      { httpStatus: 409 },
    );
  }
}

function findOpenCharge(chargeId: Id): Charge {
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

/** `awaiting` com validade passada vira `expired`. Retorna se mudou algo. */
function expireStale(): boolean {
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

function paymentsOf(chargeId: Id): OnlinePayment[] {
  return store.onlinePayments
    .filter((p) => p.chargeId === chargeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function methodLabel(method: OnlinePaymentMethod): string {
  return method === "pix" ? "Pix" : "link de pagamento";
}

/** Forma de pagamento gravada na cobranca (ver decisoes no topo). */
function chargeMethodFor(method: OnlinePaymentMethod): PaymentMethod {
  return method === "link" ? "card" : "pix";
}

/**
 * Cancela os pagamentos online em aberto da cobranca (pagar manual, cancelar a
 * cobranca, gerar um novo codigo). Uso interno de services, dentro da escrita
 * deles. Retorna quantos cancelou.
 */
export function cancelOnlinePaymentsForCharge(chargeId: Id, reason?: string): number {
  let count = 0;
  for (const p of store.onlinePayments) {
    if (p.chargeId === chargeId && p.status === "awaiting") {
      p.status = "canceled";
      if (reason) p.canceledReason = reason;
      count += 1;
    }
  }
  return count;
}

function activeAuthorizationOf(
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
  if (paid > 0) persist();
  return paid;
}

function validateSettings(next: OnlinePaymentSettings): void {
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
  if (fields.length > 0) throw validationError(fields);
}

function recurringLabel(studentId: Id): string {
  return `Pix Automático de ${studentName(studentId)}`;
}

function findAuthorization(id: Id): RecurringAuthorization {
  const a = store.recurringAuthorizations.find((x) => x.id === id);
  if (!a) throw notFoundError("Autorização do Pix Automático não encontrada.");
  return a;
}

export const onlinePaymentsService = {
  // --- Configuracao -----------------------------------------------------------
  getSettings(): Promise<OnlinePaymentSettings> {
    return simulateRead(() => clone(currentSettings()));
  },

  /** Sincroniza o status de aprovação da subconta no store do cliente. */
  syncSubaccountApproved(data: {
    gatewayAccountId?: string;
    gatewayWalletId?: string;
    gatewayStatus: "not_configured" | "approved" | "pending" | "rejected";
  }): void {
    store.organization = {
      ...store.organization,
      settings: {
        ...store.organization.settings,
        onlinePayments: {
          ...store.organization.settings?.onlinePayments,
          enabled: true,
          gatewayProvider: "asaas",
          gatewayAccountId: data.gatewayAccountId,
          gatewayWalletId: data.gatewayWalletId,
          gatewayStatus: data.gatewayStatus,
        },
      },
    };
    persist();
  },

  /** Grava em `organization.settings.onlinePayments` (proprietario/gerente). */
  updateSettings(
    payload: UpdateOnlinePaymentSettings,
  ): Promise<OnlinePaymentSettings> {
    return simulateWrite(async () => {
      assertFeature("online_payments");
      const before = currentSettings();
      const pixKey =
        payload.pixKey !== undefined
          ? payload.pixKey.trim() || undefined
          : before.pixKey;
      const next: OnlinePaymentSettings = {
        ...before,
        enabled: payload.enabled ?? before.enabled,
        pixKey,
        defaultExpiresInMinutes:
          payload.defaultExpiresInMinutes ?? before.defaultExpiresInMinutes,
        passFeeToCustomer:
          payload.passFeeToCustomer !== undefined
            ? payload.passFeeToCustomer
            : before.passFeeToCustomer,
        passFeePix:
          payload.passFeePix !== undefined
            ? payload.passFeePix
            : before.passFeePix,
        passFeeCard:
          payload.passFeeCard !== undefined
            ? payload.passFeeCard
            : before.passFeeCard,
      };
      validateSettings(next);
      store.organization = {
        ...store.organization,
        settings: { ...store.organization.settings, onlinePayments: next },
      };

      if (isSupabaseOrganization(store.organization.id)) {
        try {
          await updateOrganizationOnlineSettingsAction(store.organization.id, {
            enabled: next.enabled,
            pixKey: next.pixKey,
            defaultExpiresInMinutes: next.defaultExpiresInMinutes,
            passFeeToCustomer: next.passFeeToCustomer,
            passFeePix: next.passFeePix,
            passFeeCard: next.passFeeCard,
          });
        } catch (dbErr) {
          console.error(
            "[onlinePaymentsService] Erro ao sincronizar settings com Supabase:",
            dbErr,
          );
        }
      }

      const toggled = before.enabled !== next.enabled;
      auditLogService.record({
        action: "updated",
        target: { type: "settings", label: "Pagamento online" },
        predicate: toggled
          ? `${next.enabled ? "ligou" : "desligou"} a cobrança online`
          : "atualizou a configuração do pagamento online",
        changes: toggled
          ? [
              {
                field: "enabled",
                label: "Cobrança online",
                before: before.enabled ? "Ligada" : "Desligada",
                after: next.enabled ? "Ligada" : "Desligada",
              },
            ]
          : undefined,
        security: true,
      });
      return clone(currentSettings());
    });
  },

  // --- Cobranca online (Pix / link) -------------------------------------------
  listForCharge(chargeId: Id): Promise<OnlinePayment[]> {
    return simulateRead(() => {
      if (expireStale()) persist();
      return clone(paymentsOf(chargeId));
    });
  },

  /** Dados do dialogo "Cobrar online": aluno, telefone e os pagamentos da cobranca. */
  getCheckout(chargeId: Id): Promise<OnlineChargeCheckout> {
    return simulateRead(async () => {
      if (expireStale()) persist();
      const c = store.charges.find((x) => x.id === chargeId);
      if (!c) throw notFoundError("Cobrança não encontrada.");
      const student = store.clients.find((s) => s.id === c.studentId);
      let payments = paymentsOf(c.id);

      if (isSupabaseOrganization(store.organization.id)) {
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

    // Determina se a taxa será repassada ao aluno
    const passFee =
      passFeeOverride !== undefined
        ? passFeeOverride
        : method === "pix"
          ? Boolean(settings.passFeePix ?? settings.passFeeToCustomer ?? false)
          : Boolean(settings.passFeeCard ?? settings.passFeeToCustomer ?? false);

    // Taxa do GestaraHub por plano e tarifa do Asaas por meio (doc 19 §4, decisao A).
    const splitAmountCents = platformSplitCents(store.organization.subscription?.tier);
    const { chargedAmountCents, netAmountCents, gatewayFeeCents } = calculateOnlineChargeAmounts({
      amountCents: charge.amountCents,
      method,
      splitAmountCents,
      passFee,
    });

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
            studentName: student?.name,
            studentPhone: student?.phone,
            studentEmail: student?.email,
            chargeDueDate: charge.dueDate,
            competence: charge.competence,
            planName: plan?.name,
            chargeKind: charge.kind,
            description: charge.description,
          })
        : await paymentGateway.createLink({
            chargeId,
            amountCents: chargedAmountCents,
            splitAmountCents,
            expiresInMinutes,
            merchantName: store.organization.name,
            studentId: charge.studentId,
            studentName: student?.name,
            studentPhone: student?.phone,
            studentEmail: student?.email,
            chargeDueDate: charge.dueDate,
            competence: charge.competence,
            planName: plan?.name,
            chargeKind: charge.kind,
            description: charge.description,
          });

    // Conta real nunca entrega codigo de demonstracao ao aluno: avisa o motivo.
    const gatewayProvider = provided.provider ?? "mock";
    if (gatewayProvider === "mock" && isSupabaseOrganization(store.organization.id)) {
      throw apiError(
        "NETWORK",
        `Não foi possível gerar ${method === "pix" ? "o Pix" : "o link"} no Asaas. ${provided.fallbackReason ?? ""}`.trim(),
        { httpStatus: 502 },
      );
    }

    return simulateWrite(async () => {
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
              pixQrCodeBase64: provided.pixQrCodeBase64,
            }
          : {}),
        ...("linkUrl" in provided ? { linkUrl: provided.linkUrl } : {}),
        expiresAt: provided.expiresAt,
        createdAt: nowIso(),
      };

      if (isSupabaseOrganization(store.organization.id)) {
        try {
          await cancelOnlinePaymentsForChargeInDb(
            c.id,
            store.organization.id,
            "Substituído por novo código",
          );
          await insertOnlinePaymentInDb(payment, c.studentId);
        } catch (dbErr) {
          console.error("[onlinePaymentsService] Erro ao salvar online_payment no banco:", dbErr);
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
    return simulateWrite(async () => {
      assertFeature("online_payments");

      if (isSupabaseOrganization(store.organization.id)) {
        const result = await simulateOnlinePaidAction(onlinePaymentId);
        if (!result) {
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
    return simulateWrite(() => {
      assertFeature("online_payments");
      return { canceled: cancelOnlinePaymentsForCharge(chargeId) };
    });
  },

  // --- Pix Automatico -------------------------------------------------------
  /** Autorizacao mais recente do aluno (qualquer status) ou null. */
  getRecurringForStudent(
    studentId: Id,
  ): Promise<RecurringAuthorization | null> {
    return simulateRead(() => {
      const latest = store.recurringAuthorizations
        .filter((a) => a.studentId === studentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return latest ? clone(latest) : null;
    });
  },

  /** Autorizacoes ativas do tenant (aviso de limite em Cobrancas). */
  listActiveRecurring(): Promise<RecurringAuthorization[]> {
    return simulateRead(() =>
      clone(store.recurringAuthorizations.filter((a) => a.status === "active")),
    );
  },

  async requestRecurring(
    studentId: Id,
    maxAmountCents: number,
  ): Promise<RecurringAuthorization> {
    assertFeature("online_payments");
    assertOnlineEnabled();
    const student = store.clients.find((c) => c.id === studentId);
    if (!student) throw notFoundError("Aluno não encontrado.");
    if (!student.planId) {
      throw apiError(
        "VALIDATION",
        "O Pix Automático é para alunos com plano de mensalidade.",
        {
          httpStatus: 409,
        },
      );
    }
    if (!Number.isInteger(maxAmountCents) || maxAmountCents <= 0) {
      throw validationError([
        {
          field: "maxAmountCents",
          message: "Informe um limite maior que zero.",
        },
      ]);
    }
    const provided = await paymentGateway.requestRecurringAuthorization({
      studentId,
      maxAmountCents,
    });

    return simulateWrite(() => {
      const open = store.recurringAuthorizations.find(
        (a) =>
          a.studentId === studentId &&
          (a.status === "pending" || a.status === "active"),
      );
      if (open) {
        throw apiError(
          "VALIDATION",
          open.status === "active"
            ? "Este aluno já tem Pix Automático ativo."
            : "Já existe uma solicitação aguardando a autorização do aluno.",
          { httpStatus: 409 },
        );
      }
      const authorization: RecurringAuthorization = {
        ...provided,
        organizationId: store.organization.id,
        studentId,
        maxAmountCents,
        status: "pending",
        createdAt: nowIso(),
      };
      store.recurringAuthorizations.push(authorization);
      auditLogService.record({
        action: "created",
        target: {
          type: "online_payment",
          id: authorization.id,
          label: recurringLabel(studentId),
        },
        predicate: `solicitou o Pix Automático de ${studentName(studentId)} (limite de ${formatCents(maxAmountCents)} por cobrança)`,
      });
      return clone(authorization);
    });
  },

  /** Demonstracao: o aluno autorizou no app do banco. Ja processa o que venceu. */
  simulateAuthorize(id: Id): Promise<RecurringAuthorization> {
    return simulateWrite(() => {
      assertFeature("online_payments");
      const a = findAuthorization(id);
      if (a.status !== "pending") {
        throw apiError(
          "VALIDATION",
          "Esta autorização não está aguardando o aluno.",
          { httpStatus: 409 },
        );
      }
      if (activeAuthorizationOf(a.studentId)) {
        throw apiError(
          "VALIDATION",
          "Este aluno já tem Pix Automático ativo.",
          { httpStatus: 409 },
        );
      }
      a.status = "active";
      a.authorizedAt = nowIso();
      auditLogService.record({
        action: "activated",
        target: {
          type: "online_payment",
          id: a.id,
          label: recurringLabel(a.studentId),
        },
        predicate: `registrou a autorização (demonstração) do Pix Automático de ${studentName(a.studentId)}`,
      });
      applyRecurringAutoPayments();
      return clone(a);
    });
  },

  /** Revoga a autorizacao ativa ou cancela a solicitacao pendente. */
  revokeRecurring(id: Id): Promise<RecurringAuthorization> {
    return simulateWrite(() => {
      assertFeature("online_payments");
      const a = findAuthorization(id);
      if (a.status === "revoked") {
        throw apiError("VALIDATION", "Esta autorização já foi revogada.", {
          httpStatus: 409,
        });
      }
      const wasPending = a.status === "pending";
      a.status = "revoked";
      a.revokedAt = nowIso();
      auditLogService.record({
        action: "inactivated",
        target: {
          type: "online_payment",
          id: a.id,
          label: recurringLabel(a.studentId),
        },
        predicate: wasPending
          ? `cancelou a solicitação do Pix Automático de ${studentName(a.studentId)}`
          : `revogou o Pix Automático de ${studentName(a.studentId)}`,
      });
      return clone(a);
    });
  },
};
