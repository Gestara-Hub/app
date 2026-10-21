import type { Client, ClientFilter, CreateClient, Id, PaginatedResult } from "@gestarahub/contracts";
import { paginateArray } from "@gestarahub/contracts";
import { isSupabaseOrganization } from "@/lib/session";
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
import { insertChargesInDb } from "../billingBackend";
import {
  createClientInDb,
  getClientFromDb,
  listClientsFromDb,
  listClientsPaginatedFromDb,
} from "../clientsBackend";
import { clientNoun } from "../nouns";
import { ensurePlanlessScholarCharges, initialMembershipCharge } from "./clientMembership";
import { NOT_FOUND, clone } from "./clientStore";
import { validateClient } from "./clientValidation";

/** Cadastro, lista e leitura do aluno. */
export const clientBaseService = {
  list(filter?: ClientFilter): Promise<Client[]> {
    return simulateRead(async () => {
      if (isSupabaseOrganization(store.organization.id)) {
        const dbClients = await listClientsFromDb(store.organization.id, filter);
        const dbIds = new Set(dbClients.map((c) => c.id));
        store.clients = [
          ...store.clients.filter((c) => c.organizationId === store.organization.id ? !dbIds.has(c.id) : true),
          ...dbClients,
        ];
        return clone(dbClients);
      }

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
      if (isSupabaseOrganization(store.organization.id)) {
        const paginated = await listClientsPaginatedFromDb(store.organization.id, filter);
        const dbIds = new Set(paginated.items.map((c) => c.id));
        store.clients = [
          ...store.clients.filter((c) => c.organizationId === store.organization.id ? !dbIds.has(c.id) : true),
          ...paginated.items,
        ];
        return clone(paginated);
      }

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
      if (isSupabaseOrganization(store.organization.id)) {
        const dbClient = await getClientFromDb(store.organization.id, id);
        if (!dbClient) throw notFoundError(NOT_FOUND);
        const idx = store.clients.findIndex((c) => c.id === id);
        if (idx !== -1) {
          store.clients[idx] = dbClient;
        } else {
          store.clients.push(dbClient);
        }
        return clone(dbClient);
      }

      const found = store.clients.find((c) => c.id === id);
      if (!found) throw notFoundError(NOT_FOUND);
      return clone(found);
    });
  },

  create(payload: CreateClient): Promise<Client> {
    return simulateWrite(async () => {
      validateClient(payload, { partial: false });

      if (isSupabaseOrganization(store.organization.id)) {
        const client = await createClientInDb(store.organization.id, payload);
        store.clients.push(client);

        if (client.planId && payload.initialCharge && (payload.initialCharge.amountCents > 0 || client.discount?.scholarship)) {
          const initialCharge = initialMembershipCharge(client, payload.initialCharge);
          store.charges.push(initialCharge);
          await insertChargesInDb([initialCharge]);
        }
        ensurePlanlessScholarCharges(client);

        auditLogService.record({
          action: "created",
          target: { type: "client", id: client.id, label: client.name },
          predicate: `criou o ${clientNoun()} ${client.name}`,
        });
        return clone(client);
      }

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
