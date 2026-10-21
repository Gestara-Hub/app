import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type {
  Organization,
  Unit,
  User,
} from "@gestarahub/contracts";
import type { MockStore, MockWorld } from "./store";
import { defaultMessageTemplates, defaultWhatsAppConnection } from "@/services/defaults";

// Padroes de produto (doc 15, fatia 4): moram em services/defaults.
export {
  defaultFinancialCategories,
  defaultMessageTemplates,
  defaultSystemFinancialCategory,
  defaultWhatsAppConnection,
  systemFinancialCategoryId,
} from "@/services/defaults";

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

export function emptyStore(organization: Organization, unit: Unit, users: User[]): MockStore {
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
    lessonPackages: [],
    studentPackages: [],
    waitlist: [],
    reservations: [],
    financialCategories: [],
    financialEntries: [],
    financialRecurrences: [],
    teacherPayRules: [],
    teacherPayouts: [],
    onlinePayments: [],
    recurringAuthorizations: [],
    whatsAppConnection: defaultWhatsAppConnection(organization.id),
    messageTemplates: defaultMessageTemplates(organization.id),
    messageLogs: [],
  };
}

// --- Tenant 1: "Corte Nobre" (Modelo 1 — atendimento individual) -----------

function seedCorteNobre(): MockStore {
  const organization: Organization = {
    id: ORG_ID,
    name: "Corte Nobre",
    segment: "Barbearia",
    model: "scheduling",
    settings: {
      defaultDueDay: 10,
      billingTiming: "prepaid",
      midMonthStrategy: "prorated",
    },
    subscription: { tier: "free" },
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


/** Mundo multi-tenant: Corte Nobre (M1) + Academia X (M3). Ativo = Corte Nobre. */
export function createInitialWorld(): MockWorld {
  // O modelo de turmas saiu do mock (doc 15, fatia 4): a demonstracao dele e
  // um espaco no banco (pnpm demo:local) e os testes de regra montam a
  // academia em src/test/academy.ts. Fica so a barbearia (modelo de agenda).
  const corteNobre = seedCorteNobre();
  return {
    tenants: {
      [corteNobre.organization.id]: corteNobre,
    },
    activeOrganizationId: corteNobre.organization.id,
  };
}
