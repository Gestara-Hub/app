import { format } from "date-fns";
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

  const store = emptyStore(organization, unit, users);

  // Modalidades (categorias)
  store.categories.push(
    {
      id: "cat-judo",
      organizationId: ORG_ACADEMIA,
      name: "Judô",
      position: 1,
      status: "active",
      ...timestamps(),
    },
    {
      id: "cat-pilates",
      organizationId: ORG_ACADEMIA,
      name: "Pilates",
      position: 2,
      status: "active",
      ...timestamps(),
    }
  );

  // Planos de mensalidade
  store.plans.push(
    {
      id: "plan-judo-mensal",
      organizationId: ORG_ACADEMIA,
      name: "Plano Mensal Judô",
      priceCents: 22000,
      period: "monthly",
      status: "active",
      ...timestamps(),
    },
    {
      id: "plan-livre",
      organizationId: ORG_ACADEMIA,
      name: "Plano Livre Academia",
      priceCents: 29000,
      period: "monthly",
      status: "active",
      ...timestamps(),
    }
  );

  // Profissionais / Instrutores
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

  // Turmas
  store.classGroups.push(
    {
      id: "class-judo-adulto",
      organizationId: ORG_ACADEMIA,
      unitId: UNIT_ACADEMIA,
      name: "Judô adulto",
      modalityId: "cat-judo",
      instructorId: "prof-carlos",
      enrollmentType: "fixed",
      capacity: 10,
      planId: "plan-judo-mensal",
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
      modalityId: "cat-judo",
      instructorId: "prof-aron",
      enrollmentType: "fixed",
      capacity: 20,
      planId: "plan-judo-mensal",
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

  // Alunos (Clientes)
  store.clients.push(
    {
      id: "cli-lucas",
      organizationId: ORG_ACADEMIA,
      name: "Lucas Ferreira",
      phone: digits("(11) 98111-2233"),
      email: "lucas.ferreira@email.com",
      status: "active",
      ...timestamps(),
    },
    {
      id: "cli-mariana",
      organizationId: ORG_ACADEMIA,
      name: "Mariana Costa",
      phone: digits("(11) 98222-3344"),
      email: "mariana.costa@email.com",
      status: "active",
      ...timestamps(),
    },
    {
      id: "cli-gabriel",
      organizationId: ORG_ACADEMIA,
      name: "Gabriel Lima",
      phone: digits("(11) 98333-4455"),
      email: "gabriel.lima@email.com",
      status: "active",
      ...timestamps(),
    },
    {
      id: "cli-beatriz",
      organizationId: ORG_ACADEMIA,
      name: "Beatriz Souza",
      phone: digits("(11) 98444-5566"),
      email: "beatriz.souza@email.com",
      status: "active",
      ...timestamps(),
    },
    {
      id: "cli-pedro",
      organizationId: ORG_ACADEMIA,
      name: "Pedro Rocha",
      phone: digits("(11) 98555-6677"),
      email: "pedro.rocha@email.com",
      status: "active",
      ...timestamps(),
    }
  );

  // Matrículas ativas
  store.enrollments.push(
    {
      id: "enr-lucas",
      classGroupId: "class-judo-infantil",
      studentId: "cli-lucas",
      status: "active",
      enrolledAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "enr-mariana",
      classGroupId: "class-judo-infantil",
      studentId: "cli-mariana",
      status: "active",
      enrolledAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "enr-gabriel",
      classGroupId: "class-judo-infantil",
      studentId: "cli-gabriel",
      status: "active",
      enrolledAt: "2026-09-02T10:00:00.000Z",
    },
    {
      id: "enr-beatriz",
      classGroupId: "class-judo-adulto",
      studentId: "cli-beatriz",
      status: "active",
      enrolledAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "enr-pedro",
      classGroupId: "class-judo-adulto",
      studentId: "cli-pedro",
      status: "active",
      enrolledAt: "2026-09-03T10:00:00.000Z",
    }
  );

  // Cobranças da competência corrente
  const curComp = format(new Date(), "yyyy-MM");
  store.charges.push(
    {
      id: "chg-1",
      organizationId: ORG_ACADEMIA,
      studentId: "cli-lucas",
      kind: "membership",
      planId: "plan-judo-mensal",
      classGroupId: "class-judo-infantil",
      competence: curComp,
      dueDate: `${curComp}-10`,
      amountCents: 22000,
      status: "paid",
      paidAt: `${curComp}-05T14:00:00.000Z`,
      method: "pix",
      ...timestamps(),
    },
    {
      id: "chg-2",
      organizationId: ORG_ACADEMIA,
      studentId: "cli-mariana",
      kind: "membership",
      planId: "plan-judo-mensal",
      classGroupId: "class-judo-infantil",
      competence: curComp,
      dueDate: `${curComp}-10`,
      amountCents: 22000,
      status: "paid",
      paidAt: `${curComp}-08T11:30:00.000Z`,
      method: "card",
      ...timestamps(),
    },
    {
      id: "chg-3",
      organizationId: ORG_ACADEMIA,
      studentId: "cli-gabriel",
      kind: "membership",
      planId: "plan-judo-mensal",
      classGroupId: "class-judo-infantil",
      competence: curComp,
      dueDate: `${curComp}-15`,
      amountCents: 22000,
      status: "pending",
      ...timestamps(),
    },
    {
      id: "chg-4",
      organizationId: ORG_ACADEMIA,
      studentId: "cli-beatriz",
      kind: "membership",
      planId: "plan-judo-mensal",
      classGroupId: "class-judo-adulto",
      competence: curComp,
      dueDate: `${curComp}-10`,
      amountCents: 22000,
      status: "paid",
      paidAt: `${curComp}-06T09:00:00.000Z`,
      method: "pix",
      ...timestamps(),
    },
    {
      id: "chg-5",
      organizationId: ORG_ACADEMIA,
      studentId: "cli-pedro",
      kind: "membership",
      planId: "plan-judo-mensal",
      classGroupId: "class-judo-adulto",
      competence: curComp,
      dueDate: `${curComp}-12`,
      amountCents: 22000,
      status: "pending",
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
