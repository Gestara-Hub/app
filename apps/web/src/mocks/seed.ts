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
    status: "active",
  };

  const unit: Unit = {
    id: UNIT_ID,
    organizationId: ORG_ID,
    name: "Corte Nobre - Matriz",
    address: "Rua das Tesouras, 120 - Centro",
    phone: digits("(11) 4002-8922"),
    status: "active",
    businessHours: [
      { weekday: 0, closed: true },
      { weekday: 1, closed: false, start: "09:00", end: "20:00" },
      { weekday: 2, closed: false, start: "09:00", end: "20:00" },
      { weekday: 3, closed: false, start: "09:00", end: "20:00" },
      { weekday: 4, closed: false, start: "09:00", end: "20:00" },
      { weekday: 5, closed: false, start: "09:00", end: "20:00" },
      { weekday: 6, closed: false, start: "08:00", end: "18:00" },
    ],
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
    status: "active",
  };

  const unit: Unit = {
    id: UNIT_ACADEMIA,
    organizationId: ORG_ACADEMIA,
    name: "Academia X - Unidade 1",
    address: "Av. das Modalidades, 300 - Centro",
    phone: digits("(11) 4003-1000"),
    status: "active",
    businessHours: [
      { weekday: 0, closed: true },
      { weekday: 1, closed: false, start: "07:00", end: "22:00" },
      { weekday: 2, closed: false, start: "07:00", end: "22:00" },
      { weekday: 3, closed: false, start: "07:00", end: "22:00" },
      { weekday: 4, closed: false, start: "07:00", end: "22:00" },
      { weekday: 5, closed: false, start: "07:00", end: "22:00" },
      { weekday: 6, closed: false, start: "08:00", end: "14:00" },
    ],
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

  const store = emptyStore(organization, unit, users);

  // Seed com alguns profissionais e turmas para teste
  store.professionals.push(
    {
      id: "prof-carlos",
      organizationId: ORG_ACADEMIA,
      unitId: UNIT_ACADEMIA,
      name: "Carlos Antonio",
      phone: digits("(11) 98765-4321"),
      status: "active",
      workingHours: [],
      serviceIds: [],
      ...timestamps(),
    },
    {
      id: "prof-aron",
      organizationId: ORG_ACADEMIA,
      unitId: UNIT_ACADEMIA,
      name: "Aron Bezerra",
      phone: digits("(11) 99876-5432"),
      status: "active",
      workingHours: [],
      serviceIds: [],
      ...timestamps(),
    }
  );

  store.classGroups.push(
    {
      id: "class-judo-adulto",
      organizationId: ORG_ACADEMIA,
      unitId: UNIT_ACADEMIA,
      name: "Judô adulto",
      instructorId: "prof-carlos",
      enrollmentType: "fixed",
      capacity: 10,
      meetingSlots: [
        { weekday: 2, start: "18:00", end: "19:00" },
        { weekday: 4, start: "18:00", end: "19:00" },
      ],
      startDate: "2026-09-08",
      status: "active",
      ...timestamps(),
    },
    {
      id: "class-judo-infantil",
      organizationId: ORG_ACADEMIA,
      unitId: UNIT_ACADEMIA,
      name: "Judô infantil",
      instructorId: "prof-aron",
      enrollmentType: "fixed",
      capacity: 20,
      meetingSlots: [
        { weekday: 1, start: "18:00", end: "19:00" },
        { weekday: 3, start: "18:00", end: "19:00" },
        { weekday: 5, start: "18:00", end: "19:00" },
      ],
      startDate: "2026-09-08",
      status: "active",
      ...timestamps(),
    }
  );

  return store;
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
