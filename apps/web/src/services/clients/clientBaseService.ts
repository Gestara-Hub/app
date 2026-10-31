import type { Client, ClientFilter, CreateClient, Id, PaginatedResult } from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { store } from "@/services/world/store";
import {
  newId,
  notFoundError,
  nowIso,
  readOp,
  writeOp,
  phoneIncludes,
  textIncludes,
} from "@/services/world/ops";
import { auditLogService } from "../audit/auditLogService";
import { clientNoun } from "../world/nouns";
import { alignFullCycleDueDay, ensurePlanlessScholarCharges, initialMembershipCharge } from "./clientMembership";
import { NOT_FOUND, clone, todayISO } from "./clientStore";
import { validateClient } from "./clientValidation";
import { cpfDigits } from "@gestarahub/core/payer";
import { teacherStudentIds } from "../classes/teacherScope";
import { clientWithoutMoney } from "./studentSummaryRules";
import { consentFieldsFor } from "./clientConsentRules";

/**
 * O professor ve so os alunos das turmas dele, sem dinheiro, documentos nem
 * endereco (como na ficha); os outros perfis, todos, completos.
 */
function visibleClients(): Client[] {
  const allowed = teacherStudentIds();
  return allowed ? store.clients.filter((c) => allowed.has(c.id)).map(clientWithoutMoney) : store.clients;
}

/**
 * Aluno antigo sem os meses passados: so com plano, depois do inicio e ate hoje
 * (nunca uma data futura que pularia as cobrancas que vem por ai).
 */
function validChargesFrom(payload: CreateClient): string | undefined {
  const from = payload.chargesFrom;
  if (!from || !payload.planId || !payload.planStartDate) return undefined;
  return from > payload.planStartDate && from <= todayISO() ? from : undefined;
}

/** Cadastro, lista e leitura do aluno. */
export const clientBaseService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return readOp(async () => {

      let result = visibleClients();
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (c) => textIncludes(c.name, term) || phoneIncludes(c.phone, term),
        );
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      return clone(
        [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    });
  },

  listPaginated(filter?: ClientFilter): Promise<PaginatedResult<Client>> {
    return readOp(async () => {

      let result = visibleClients();
      if (filter?.search) {
        const term = filter.search;
        result = result.filter(
          (c) => textIncludes(c.name, term) || phoneIncludes(c.phone, term),
        );
      }
      if (filter?.status) {
        result = result.filter((c) => c.status === filter.status);
      }
      if (filter?.planId) {
        result = result.filter((c) => c.planId === filter.planId);
      }
      if (filter?.membershipStatus) {
        result = result.filter((c) => c.membershipStatus === filter.membershipStatus);
      }

      const sorted = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return clone(paginateArray(sorted, filter?.page, filter?.pageSize));
    });
  },

  getById(id: Id): Promise<Client> {
    return readOp(async () => {

      const found = visibleClients().find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return writeOp(async () => {
      validateClient(payload, { partial: false });

      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        birthDate: payload.birthDate || undefined,
        cpf: cpfDigits(payload.cpf) || undefined,
        guardians: payload.guardians?.length ? payload.guardians : undefined,
        notes: payload.notes?.trim() || undefined,
        address: payload.address,
        planId: payload.planId || undefined,
        planStartDate: payload.planStartDate || undefined,
        chargesFrom: validChargesFrom(payload),
        billingStrategy: payload.billingStrategy || undefined,
        cyclePaymentTiming: payload.cyclePaymentTiming || undefined,
        dueDay: payload.dueDay || store.organization.settings?.defaultDueDay || 10,
        discount: payload.discount,
        membershipStatus: payload.membershipStatus ?? "active",
        // Autorizacao do menor: a regra do servidor, nao o que o navegador mandou.
        ...consentFieldsFor(payload),
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
      alignFullCycleDueDay(client);
      store.clients.push(client);

      // 1a mensalidade (calculada no cadastro pelo motor de cobranca e ajustavel).
      // Bolsa integral gera a 1a mensalidade como "Isento" (R$ 0).
      if (client.planId && payload.initialCharge && (payload.initialCharge.amountCents > 0 || client.discount?.scholarship)) {
        store.charges.push(initialMembershipCharge(client, payload.initialCharge));
      }
      ensurePlanlessScholarCharges(client);

      auditLogService.record({
        action: "created",
        target: { type: "client", id: client.id, label: client.name },
        predicate: `criou o ${clientNoun()} ${client.name}`,
      });
      return clone(client);
    });
  },
};
