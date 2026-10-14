import { ORG_ID, UNIT_ID } from "@/config/tenant";
import type {
  ClassesBusinessSegment,
  FinancialCategory,
  FinancialEntryType,
  FinancialSystemCategoryKey,
  Id,
  MessageTemplate,
  Organization,
  Unit,
  User,
  WhatsAppConnection,
} from "@gestarahub/contracts";
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

// Categorias financeiras padrao (docs/technical/05, secao 4.3). As de sistema
// representam fontes automaticas (cobrancas e pagamento de professores) e nao
// podem ser escolhidas num lancamento manual. Ids deterministicos por tenant.
const DEFAULT_FINANCIAL_CATEGORIES: {
  key: string;
  type: FinancialEntryType;
  name: string;
  systemKey?: FinancialSystemCategoryKey;
}[] = [
  { key: "memberships", type: "income", name: "Mensalidades", systemKey: "memberships" },
  { key: "dropins", type: "income", name: "Aulas avulsas", systemKey: "dropins" },
  { key: "products", type: "income", name: "Venda de produtos" },
  { key: "events", type: "income", name: "Eventos e seminários" },
  { key: "graduation", type: "income", name: "Taxa de graduação" },
  { key: "other-income", type: "income", name: "Outras receitas" },
  { key: "teachers", type: "expense", name: "Professores", systemKey: "teachers" },
  { key: "rent", type: "expense", name: "Aluguel" },
  { key: "utilities", type: "expense", name: "Contas (luz, água, internet)" },
  { key: "equipment", type: "expense", name: "Material e equipamentos" },
  { key: "marketing", type: "expense", name: "Marketing" },
  { key: "taxes", type: "expense", name: "Impostos e taxas" },
  { key: "other-expense", type: "expense", name: "Outras despesas" },
];

/** Id deterministico da categoria de sistema do tenant (para os services). */
export function systemFinancialCategoryId(
  organizationId: Id,
  key: FinancialSystemCategoryKey,
): Id {
  return `fcat-${organizationId}-${key}`;
}

export function defaultFinancialCategories(organizationId: Id): FinancialCategory[] {
  return DEFAULT_FINANCIAL_CATEGORIES.map((c) => ({
    id: `fcat-${organizationId}-${c.key}`,
    organizationId,
    type: c.type,
    name: c.name,
    ...(c.systemKey ? { system: true, systemKey: c.systemKey } : {}),
    status: "active",
    ...timestamps(),
  }));
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

const ORG_ACADEMIA = "org-academia-x";
const UNIT_ACADEMIA = "unit-academia-x";

function seedAcademia(): MockStore {
  const organization: Organization = {
    id: ORG_ACADEMIA,
    name: "Academia X",
    segment: "Academia",
    model: "classes",
    settings: {
      defaultDueDay: 10,
    },
    subscription: { tier: "free" },
    status: "active",
  };

  const unit: Unit = {
    id: UNIT_ACADEMIA,
    organizationId: ORG_ACADEMIA,
    name: "",
    address: undefined,
    phone: undefined,
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

  return {
    ...emptyStore(organization, unit, users),
    financialCategories: defaultFinancialCategories(ORG_ACADEMIA),
  };
}

/**
 * WhatsApp do espaco: comeca no envio assistido (gratis). A conexao oficial
 * (Pro) e feita pelo espaco, com o proprio numero.
 */
export function defaultWhatsAppConnection(organizationId: Id): WhatsAppConnection {
  return {
    organizationId,
    officialStatus: "not_connected",
    allowedSendHours: { start: "08:00", end: "20:00" },
    monthlyQuota: { used: 0, included: 1000 },
  };
}

/** Trechos que mudam conforme a area: lutas fala em treino e tatame; o resto, em aula. */
function messageTone(segment: ClassesBusinessSegment | undefined) {
  if (!segment || segment === "martial_arts") {
    return {
      closing: " Bons treinos! 🥋",
      welcomeTail: "acompanhar seus treinos, horários e graduações. Nos vemos no tatame!",
      absenceLine: "nos últimos treinos da {empresa}. Seu lugar no tatame está guardado!",
    };
  }
  return {
    closing: " Boas aulas!",
    welcomeTail: "acompanhar suas aulas, horários e evolução. Até a primeira aula!",
    absenceLine: "nas últimas aulas da {empresa}. Seu lugar na turma está guardado!",
  };
}

export function defaultMessageTemplates(
  organizationId: Id,
  segment?: ClassesBusinessSegment,
): MessageTemplate[] {
  const ts = timestamps();
  const tone = messageTone(segment);
  return [
    {
      id: `tmpl-${organizationId}-before-due`,
      organizationId,
      trigger: "billing_before_due",
      category: "billing",
      title: "Lembrete de Vencimento (Preventivo)",
      description: "Disparado 3 dias antes do vencimento da mensalidade",
      enabled: true,
      sendHour: "09:00",
      daysOffset: -3,
      content:
        `Olá, {aluno}! Passando para lembrar que sua mensalidade de {valor} na {empresa} vence em {vencimento}. Pague com facilidade pelo Pix Copia e Cola: {link_pagamento}.${tone.closing}`,
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-due-date`,
      organizationId,
      trigger: "billing_due_date",
      category: "billing",
      title: "Vencimento Hoje",
      description: "Disparado no dia do vencimento da mensalidade",
      enabled: true,
      sendHour: "09:30",
      daysOffset: 0,
      content:
        "Olá, {aluno}! Sua mensalidade da {empresa} no valor de {valor} vence hoje ({vencimento}). Garanta sua vaga ativa acessando o link seguro de pagamento: {link_pagamento}. Obrigado!",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-after-due`,
      organizationId,
      trigger: "billing_after_due",
      category: "billing",
      title: "Aviso de Atraso (3 dias)",
      description: "Disparado 3 dias após o vencimento não identificado",
      enabled: true,
      sendHour: "10:00",
      daysOffset: 3,
      content:
        "Oi, {aluno}! Notamos que a mensalidade de {valor} da {empresa} que venceu em {vencimento} ainda está em aberto. Para regularizar sem complicações, basta acessar: {link_pagamento}. Qualquer dúvida, estamos à disposição!",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-critical`,
      organizationId,
      trigger: "billing_critical",
      category: "billing",
      title: "Cobrança de Atraso Crítico (10 dias)",
      description: "Disparado 10 dias após o vencimento com aviso de bloqueio",
      enabled: false,
      sendHour: "11:00",
      daysOffset: 10,
      content:
        "Aviso Importante: Olá, {aluno}. Identificamos uma pendência na mensalidade vencida em {vencimento}. Para evitar a suspensão temporária do acesso às aulas, acesse o link de regularização: {link_pagamento} ou procure nossa recepção.",
      availableVariables: ["{aluno}", "{valor}", "{vencimento}", "{link_pagamento}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-welcome`,
      organizationId,
      trigger: "welcome_student",
      category: "retention",
      title: "Boas-Vindas ao Novo Aluno",
      description: "Disparado automaticamente ao confirmar nova matrícula",
      enabled: true,
      sendHour: "08:00",
      daysOffset: 0,
      content:
        `Seja muito bem-vindo(a) à {empresa}, {aluno}! 🎉 Sua matrícula foi confirmada com sucesso. Acesse o nosso aplicativo do aluno pelo link {link_app} para ${tone.welcomeTail}`,
      availableVariables: ["{aluno}", "{empresa}", "{link_app}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-absence`,
      organizationId,
      trigger: "absence_alert",
      category: "retention",
      title: "Sentimos sua Falta (Anti-Evasão)",
      description: "Para alunos com 3 faltas seguidas",
      enabled: true,
      sendHour: "14:00",
      daysOffset: 3,
      content:
        `Oi, {aluno}! Tudo bem? Sentimos muito a sua falta ${tone.absenceLine} Queremos te ver por aqui esta semana. Como podemos te ajudar a retomar sua rotina? 💪`,
      availableVariables: ["{aluno}", "{empresa}"],
      ...ts,
    },
    {
      id: `tmpl-${organizationId}-birthday`,
      organizationId,
      trigger: "birthday_greeting",
      category: "retention",
      title: "Felicitações de Aniversário",
      description: "Disparado no dia do aniversário do aluno cadastrado",
      enabled: true,
      sendHour: "08:30",
      daysOffset: 0,
      content:
        "Parabéns pelo seu dia, {aluno}! 🎂 Toda a equipe da {empresa} deseja muita saúde, conquistas e evolução. É uma honra ter você na nossa família! Aproveite seu dia especial.",
      availableVariables: ["{aluno}", "{empresa}"],
      ...ts,
    },
  ];
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
