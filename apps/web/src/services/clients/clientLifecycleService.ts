import type { Client, Id, UpdateClient } from "@gestarahub/contracts";
import { plural } from "@gestarahub/core/format";
import { isSupabaseOrganization } from "@/lib/session";
import { store } from "@/mocks/store";
import { notFoundError, nowIso, simulateWrite } from "@/mocks/helpers";
import { auditLogService } from "../auditLogService";
import {
  cancelOpenMembershipCharges,
  chargeStartedMembershipPeriods,
  isPlanlessScholar,
  membershipPeriodTaken,
  studentMembershipTerms,
} from "../billingService";
import { getClientFromDb, inactivateClientInDb, updateClientInDb } from "../clientsBackend";
import { clientNoun } from "../nouns";
import { endStudentEnrollments, ensurePlanlessScholarCharges, initialMembershipCharge } from "./clientMembership";
import { NOT_FOUND, clone, todayISO } from "./clientStore";
import { validateClient } from "./clientValidation";

/** Edicao (com efeitos na cobranca) e inativacao do aluno. */
export const clientLifecycleService = {
  update(id: Id, payload: UpdateClient): Promise<Client> {
    return simulateWrite(async () => {
      let current = store.clients.find((c) => c.id === id);
      if (isSupabaseOrganization(store.organization.id)) {
        if (!current) {
          const fetched = await getClientFromDb(store.organization.id, id);
          if (fetched) {
            store.clients.push(fetched);
            current = fetched;
          }
        }
        if (!current) throw notFoundError(NOT_FOUND);
        validateClient(payload, { partial: true, current });

        const updated = await updateClientInDb(store.organization.id, id, payload);
        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) store.clients[idx] = updated;
        else store.clients.push(updated);

        auditLogService.record({
          action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
          target: { type: "client", id: updated.id, label: updated.name },
          predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
        });
        return clone(updated);
      }

      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      current = store.clients[idx];
      validateClient(payload, { partial: true, current });
      const ts = nowIso();
      const updated: Client = {
        ...current,
        ...payload,
        updatedAt: ts,
      };
      // Volta do aluno (reativado ou assinatura retomada): a cobranca recomeca
      // na data da volta, pela regra dele (proporcional ou mes cheio). O tempo
      // parado nao e cobrado e o que ja foi cobrado nao se repete.
      const stopped = (c: Client) =>
        c.status !== "active" || c.membershipStatus === "paused" || c.membershipStatus === "canceled";
      const resumed = stopped(current) && !stopped(updated);
      const today = todayISO();
      if (
        resumed &&
        updated.planId &&
        (payload.planStartDate === undefined || payload.planStartDate === current.planStartDate) &&
        (updated.planStartDate ?? "") < today
      ) {
        updated.planStartDate = today;
      }
      store.clients[idx] = updated;

      // Pausa ou cancelamento da assinatura: periodos que ainda nao comecaram
      // deixam de valer (como na inativacao); o que ja foi usado segue em aberto.
      if (!stopped(current) && stopped(updated) && updated.status === "active") {
        // "Depois do uso": o periodo em uso vira cobranca agora.
        const pausedPlan = current.planId ? store.plans.find((p) => p.id === current.planId) : undefined;
        if (pausedPlan && studentMembershipTerms(current, pausedPlan).timing === "postpaid") {
          chargeStartedMembershipPeriods(current, today);
        }
        cancelOpenMembershipCharges(updated.id, today, "Cancelada na pausa da assinatura");
      }

      // Troca de plano ou de data de inicio: as mensalidades em aberto do
      // arranjo anterior a partir da nova vigencia deixam de valer.
      const planChanged =
        Boolean(updated.planId) &&
        (current.planId !== updated.planId || (!resumed && current.planStartDate !== updated.planStartDate));
      if (planChanged && current.planId && updated.planStartDate) {
        cancelOpenMembershipCharges(updated.id, updated.planStartDate, "Substituída pela troca de plano", {
          inclusive: true,
          replaced: true,
        });
      }
      // Troca da regra (momento do pagamento, entrada no meio do periodo ou dia
      // de vencimento) muda os periodos/vencimentos: as mensalidades em aberto de
      // periodos que ainda nao comecaram saem, e a geracao recria pela regra nova
      // (sem cobrar de novo o que ja foi cobrado).
      // Compara os termos efetivos (regra do aluno ou da academia), para nao
      // cancelar nada quando so muda a forma de guardar a mesma regra.
      const rulePlan = store.plans.find((p) => p.id === updated.planId);
      const beforeTerms = rulePlan ? studentMembershipTerms(current, rulePlan) : undefined;
      const afterTerms = rulePlan ? studentMembershipTerms(updated, rulePlan) : undefined;
      const rulesChanged =
        beforeTerms !== undefined &&
        afterTerms !== undefined &&
        (beforeTerms.strategy !== afterTerms.strategy ||
          beforeTerms.timing !== afterTerms.timing ||
          beforeTerms.dueDay !== afterTerms.dueDay ||
          // Desconto ou bolsa (valor, tipo, validade) muda o valor dos proximos periodos.
          JSON.stringify(current.discount ?? null) !== JSON.stringify(updated.discount ?? null));
      if (!planChanged && rulesChanged && current.planId === updated.planId) {
        cancelOpenMembershipCharges(updated.id, todayISO(), "Substituída pela troca da regra de cobrança", {
          replaced: true,
        });
      }
      if (
        updated.planId &&
        payload.initialCharge &&
        (payload.initialCharge.amountCents > 0 || updated.discount?.scholarship)
      ) {
        const charge = initialMembershipCharge(updated, payload.initialCharge);
        // Mesmo periodo ja cobrado (em qualquer plano, ex.: mes pago no plano
        // antigo) nao gera outra mensalidade.
        const taken =
          charge.periodStart && charge.periodEnd
            ? membershipPeriodTaken(updated.id, updated.planId, {
                periodStart: charge.periodStart,
                periodEnd: charge.periodEnd,
                competence: charge.competence ?? "",
                cycleIndex: charge.cycleIndex ?? 1,
              })
            : false;
        if (!taken) store.charges.push(charge);
      }

      // Bolsista integral sem plano: trocar a bolsa ou sair dela cancela as
      // isentas futuras; continuando bolsista, recria pela regra nova.
      if (
        isPlanlessScholar(current) &&
        (!isPlanlessScholar(updated) ||
          JSON.stringify(current.discount) !== JSON.stringify(updated.discount) ||
          current.planStartDate !== updated.planStartDate)
      ) {
        cancelOpenMembershipCharges(updated.id, todayISO(), "Substituída pela troca da bolsa", {
          replaced: true,
        });
      }
      ensurePlanlessScholarCharges(updated);

      auditLogService.record({
        action: current.status !== "active" && updated.status === "active" ? "activated" : "updated",
        target: { type: "client", id: updated.id, label: updated.name },
        predicate: `${current.status !== "active" && updated.status === "active" ? "reativou" : "atualizou"} o ${clientNoun()} ${updated.name}`,
      });
      return clone(updated);
    });
  },

  // remove = inativacao logica; cliente permanece no historico.
  /**
   * Inativa o aluno. Mensalidades de periodos futuros sempre saem. As em aberto
   * de periodos ja iniciados ficam como divida, salvo `cancelOpenCharges`: ai
   * sao canceladas como decisao do usuario (motivo "Aluno inativado"), contam
   * como nao cobradas e podem ser reabertas.
   */
  remove(id: Id, opts: { cancelOpenCharges?: boolean } = {}): Promise<void> {
    return simulateWrite(async () => {
      let before = store.clients.find((c) => c.id === id);
      if (isSupabaseOrganization(store.organization.id)) {
        if (!before) {
          const fetched = await getClientFromDb(store.organization.id, id);
          if (fetched) {
            store.clients.push(fetched);
            before = fetched;
          }
        }
        if (!before) throw notFoundError(NOT_FOUND);

        await inactivateClientInDb(store.organization.id, id);

        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) {
          store.clients[idx] = { ...store.clients[idx], status: "inactive", updatedAt: nowIso() };
        }
        const ended = endStudentEnrollments(id);
        const canceled = cancelOpenMembershipCharges(id, todayISO(), "Cancelada na inativação do aluno");

        auditLogService.record({
          action: "inactivated",
          target: { type: "client", id, label: before.name },
          predicate: `inativou o ${clientNoun()} ${before.name}${ended > 0 ? `, encerrou ${plural(ended, "matrícula", "matrículas")}` : ""}${canceled > 0 ? ` e cancelou ${plural(canceled, "mensalidade futura", "mensalidades futuras")}` : ""}`,
        });
        return;
      }

      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw notFoundError(NOT_FOUND);
      before = store.clients[idx];
      const name = before.name;
      // "Depois do uso": o periodo em uso (ou ja usado e ainda nao gerado) vira
      // cobranca agora, senao se perderia com a geracao pulando inativos.
      const plan = before.planId ? store.plans.find((p) => p.id === before.planId) : undefined;
      const charged =
        before.status === "active" && plan && studentMembershipTerms(before, plan).timing === "postpaid"
          ? chargeStartedMembershipPeriods(before, todayISO())
          : 0;
      store.clients[idx] = {
        ...before,
        status: "inactive",
        updatedAt: nowIso(),
      };
      // Mensalidades de periodos que ainda nao comecaram deixam de valer; o que
      // ja foi usado continua em aberto como divida.
      const canceled = cancelOpenMembershipCharges(id, todayISO(), "Cancelada na inativação do aluno");
      const ended = endStudentEnrollments(id);
      // Escolha do usuario: nao cobrar tambem o que ja estava em aberto.
      let waivedDebt = 0;
      if (opts.cancelOpenCharges) {
        const ts = nowIso();
        for (const c of store.charges) {
          if (c.kind !== "membership" || c.studentId !== id) continue;
          if (c.status !== "pending" && c.status !== "overdue") continue;
          c.status = "canceled";
          c.canceledBy = "user";
          c.cancelReason = "Aluno inativado";
          c.updatedAt = ts;
          waivedDebt += 1;
        }
      }
      auditLogService.record({
        action: "inactivated",
        target: { type: "client", id, label: name },
        predicate: `inativou o ${clientNoun()} ${name}${ended > 0 ? `, encerrou ${plural(ended, "matrícula", "matrículas")}` : ""}${charged > 0 ? `, gerou ${plural(charged, "mensalidade do período usado", "mensalidades dos períodos usados")}` : ""}${canceled > 0 ? ` e cancelou ${plural(canceled, "mensalidade futura", "mensalidades futuras")}` : ""}${waivedDebt > 0 ? `; cancelou também ${plural(waivedDebt, "mensalidade em aberto", "mensalidades em aberto")} (não serão cobradas)` : ""}`,
      });
    });
  },
};
