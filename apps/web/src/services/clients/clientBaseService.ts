import type { Client, ClientFilter, ClientOption, CreateClient, Id, PaginatedResult, TrialStudentView } from "@gestarahub/contracts";
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
import { assertCanSetDiscount, validateClient } from "./clientValidation";
import { cpfDigits } from "@gestarahub/core/payer";
import { teacherStudentIds } from "../classes/teacherScope";
import { clientWithoutMoney } from "./studentSummaryRules";
import { consentFieldsFor, whatsappConsentFieldsFor } from "./clientConsentRules";
import { trialOutcomeOf, trialStudents } from "./clientTrials";

/**
 * O professor ve so os alunos das turmas dele, sem dinheiro, documentos nem
 * endereco (como na ficha); os outros perfis, todos, completos.
 */
/**
 * Visitantes (doc product/29, decisao 2; 11/11/2026): inscricao em evento (nao
 * cancelada) e nenhum outro vinculo: sem matricula, plano, pacote nem aula
 * experimental, em qualquer situacao. Derivado: nada e gravado no aluno, e a
 * situacao do cadastro nao muda sozinha.
 */
export function visitorIds(): Set<Id> {
  const tied = new Set<Id>([
    ...store.enrollments.map((e) => e.studentId),
    ...(store.studentPackages ?? []).map((p) => p.studentId),
    ...(store.reservations ?? []).filter((r) => r.kind === "trial").map((r) => r.studentId),
    ...store.clients.filter((c) => c.planId).map((c) => c.id),
  ]);
  return new Set(
    (store.eventRegistrations ?? []).filter((r) => r.status !== "canceled" && !tied.has(r.studentId)).map((r) => r.studentId),
  );
}

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
  // So o dia 1o do mes atual, o que o cadastro manda (achado V12 de 31/10/2026):
  // uma data qualquer ate hoje pulava tambem a mensalidade deste mes ja vencida.
  return from > payload.planStartDate && from === `${todayISO().slice(0, 7)}-01` ? from : undefined;
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

  /**
   * Seletores de aluno (12/11/2026): nome, telefone, nascimento, plano e bolsa.
   * Mesmo filtro e mesma visao do professor da lista completa.
   */
  listOptions(filter?: Pick<ClientFilter, "status" | "search">): Promise<ClientOption[]> {
    return readOp(async () => {
      let result = visibleClients();
      if (filter?.search) {
        const term = filter.search;
        result = result.filter((c) => textIncludes(c.name, term) || phoneIncludes(c.phone, term));
      }
      if (filter?.status) result = result.filter((c) => c.status === filter.status);
      return [...result]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          ...(c.phone ? { phone: c.phone } : {}),
          ...(c.birthDate ? { birthDate: c.birthDate } : {}),
          ...(c.planId ? { planId: c.planId } : {}),
          ...(c.discount?.scholarship ? { scholarship: true } : {}),
        }));
    });
  },

  /**
   * Cadastro so dos alunos pedidos (chamada da aula, alunos da turma; 12/11/2026):
   * antes essas telas baixavam todos os alunos ativos para mostrar os da aula.
   * Mesma visao do professor da lista completa; quem ele nao ve fica de fora.
   */
  listByIds(ids: Id[]): Promise<Client[]> {
    return readOp(async () => {
      const wanted = new Set(ids);
      return clone(
        visibleClients()
          .filter((c) => wanted.has(c.id))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
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
      if (filter?.trial) {
        const today = todayISO();
        result = result.filter((c) => trialOutcomeOf(c, today).stage === filter.trial);
      }
      if (filter?.visitor) {
        const visitors = visitorIds();
        result = result.filter((c) => visitors.has(c.id));
      }

      const sorted = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return clone(paginateArray(sorted, filter?.page, filter?.pageSize));
    });
  },

  /** Ids dos visitantes (selo "Visitante" na lista de Alunos). */
  listVisitorIds(): Promise<Id[]> {
    return readOp(async () => {
      const visitors = visitorIds();
      return visibleClients().filter((c) => visitors.has(c.id)).map((c) => c.id);
    });
  },

  /** Alunos que fizeram aula experimental: quem ainda nao voltou e quem virou aluno. */
  listTrials(): Promise<TrialStudentView[]> {
    return readOp(async () => clone(trialStudents(visibleClients(), todayISO())));
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
      assertCanSetDiscount(payload.discount);

      const ts = nowIso();
      const client: Client = {
        id: newId(),
        organizationId: store.organization.id,
        name: payload.name.trim(),
        phone: payload.phone?.trim() || undefined,
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
        // Autorizacao do WhatsApp: data e autor do servidor (doc product/27 M1).
        ...whatsappConsentFieldsFor(payload),
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
