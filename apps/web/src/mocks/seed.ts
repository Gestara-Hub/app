import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type { Organization, Unit, User } from "@gestarahub/contracts";
import type { MockStore, MockWorld } from "./store";

/**
 * Seed "ambiente vazio": cada organizacao nasce apenas com organizacao +
 * unidade + o usuario proprietario. Nenhum cadastro operacional (profissionais,
 * servicos, clientes, categorias, cargos, turmas, planos etc.) vem pre-populado
 * — o objetivo e simular o inicio real de uso, forcando o proprietario a
 * cadastrar tudo pela propria UI.
 *
 * Keys e enum values em ingles; texto livre (nomes, enderecos) em portugues.
 */

function timestamps() {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now };
}

// Telefone e armazenado apenas com digitos; a UI formata na exibicao.
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function emptyStore(organization: Organization, unit: Unit, users: User[]): MockStore {
  return {
    organization,
    unit,
    clients: [],
    professionals: [],
    users,
    roles: [],
    categories: [],
    services: [],
    appointments: [],
    timeBlocks: [],
    series: [],
    auditLog: [],
    classGroups: [],
    enrollments: [],
    attendances: [],
    plans: [],
    charges: [],
    waitlist: [],
    makeups: [],
    reservations: [],
  };
}

// --- Tenant 1: "Corte Nobre" (Modelo 1 — atendimento individual) -----------

function seedCorteNobre(): MockStore {
  const organization: Organization = {
    id: ORG_ID,
    name: "Corte Nobre",
    segment: "Barbearia",
    model: "scheduling",
    settings: { defaultDueDay: 10 },
    status: "active",
  };

  const unit: Unit = {
    id: UNIT_ID,
    organizationId: ORG_ID,
    name: "Corte Nobre - Matriz",
    address: "Rua das Tesouras, 120 - Centro",
    phone: digits("(11) 4002-8922"),
    status: "active",
    businessHours: [],
  };

  const users: User[] = [
    {
      id: "usr-marcelo",
      organizationId: ORG_ID,
      name: "Marcelo Andrade",
      email: "marcelo@cortenobre.com",
      profile: "owner",
      status: "active",
      ...timestamps(),
    },
  ];

  return emptyStore(organization, unit, users);
}

// --- Tenant 2: "Academia X" (Modelo 3 — turmas) ----------------------------

const ORG_ACADEMIA = "org-academia-x";
const UNIT_ACADEMIA = "unit-academia-x";

function seedAcademia(): MockStore {
  const organization: Organization = {
    id: ORG_ACADEMIA,
    name: "Academia X",
    segment: "Academia",
    model: "classes",
    settings: { defaultDueDay: 10 },
    status: "active",
  };

  const unit: Unit = {
    id: UNIT_ACADEMIA,
    organizationId: ORG_ACADEMIA,
    name: "Academia X - Unidade 1",
    address: "Av. das Modalidades, 300 - Centro",
    phone: digits("(11) 4003-1000"),
    status: "active",
    businessHours: [],
  };

  const users: User[] = [
    {
      id: "usr-ac-ana",
      organizationId: ORG_ACADEMIA,
      name: "Ana Ribeiro",
      email: "ana@academiax.com",
      profile: "owner",
      status: "active",
      ...timestamps(),
    },
  ];

  return emptyStore(organization, unit, users);
}

/** Mundo multi-tenant: Corte Nobre (M1) + Academia X (M3). Ativo = Corte Nobre. */
export function createInitialWorld(): MockWorld {
  const corteNobre = seedCorteNobre();
  const academia = seedAcademia();
  return {
    tenants: {
      [corteNobre.organization.id]: corteNobre,
      [academia.organization.id]: academia,
    },
    activeOrganizationId: corteNobre.organization.id,
  };
}
