import type {
Id,RecurringAuthorization
} from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import {
apiError,notFoundError,
nowIso,
readOp,
writeOp,
validationError
} from "@/services/world/ops";
import { store } from "@/services/world/store";
import { auditLogService } from "../auditLogService";
import { paymentGateway } from "../payments/paymentGateway";
import { assertFeature } from "../subscriptionService";
import {
clone,studentName,assertOnlineEnabled
} from "./onlinePaymentRules";
import {
activeAuthorizationOf,
applyRecurringAutoPayments,
recurringLabel,
findAuthorization,
} from "./recurringRules";

/** Pix Automatico do aluno: pedir, autorizar e revogar. */
export const recurringService = {
  // --- Pix Automatico -------------------------------------------------------
  /** Autorizacao mais recente do aluno (qualquer status) ou null. */
  getRecurringForStudent(
    studentId: Id,
  ): Promise<RecurringAuthorization | null> {
    return readOp(() => {
      const latest = store.recurringAuthorizations
        .filter((a) => a.studentId === studentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return latest ? clone(latest) : null;
    });
  },
  /** Autorizacoes ativas do tenant (aviso de limite em Cobrancas). */
  listActiveRecurring(): Promise<RecurringAuthorization[]> {
    return readOp(() =>
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

    return writeOp(() => {
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
    return writeOp(() => {
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
    return writeOp(() => {
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
