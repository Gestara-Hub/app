import type { Client, ClientFilter, CreateClient, Id, PaginatedResult } from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { store } from "@/mocks/store";
import {
  newId,
  notFoundError,
  nowIso,
  simulateRead,
  simulateWrite,
  phoneIncludes,
  textIncludes,
} from "@/mocks/helpers";
import { auditLogService } from "../auditLogService";
import { clientNoun } from "../nouns";
import { ensurePlanlessScholarCharges, initialMembershipCharge } from "./clientMembership";
import { NOT_FOUND, clone } from "./clientStore";
import { validateClient } from "./clientValidation";

/** Cadastro, lista e leitura do aluno. */
export const clientBaseService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(async () => {

      let result = store.clients;
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
    return simulateRead(async () => {

      let result = store.clients;
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
    return simulateRead(async () => {

      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(async () => {
      validateClient(payload, { partial: false });

      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        birthDate: payload.birthDate || undefined,
        guardians: payload.guardians?.length ? payload.guardians : undefined,
        notes: payload.notes?.trim() || undefined,
        address: payload.address,
        planId: payload.planId || undefined,
        planStartDate: payload.planStartDate || undefined,
        billingStrategy: payload.billingStrategy || undefined,
        cyclePaymentTiming: payload.cyclePaymentTiming || undefined,
        dueDay: payload.dueDay || store.organization.settings?.defaultDueDay || 10,
        discount: payload.discount,
        membershipStatus: payload.membershipStatus ?? "active",
        minorConsentStatus: payload.minorConsentStatus || "not_applicable",
        minorConsentAt: payload.minorConsentAt || undefined,
        minorConsentBy: payload.minorConsentBy || undefined,
        minorConsentEvidence: payload.minorConsentEvidence || undefined,
        status: payload.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
      };
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
