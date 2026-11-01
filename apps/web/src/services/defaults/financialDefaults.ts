import {
  type FinancialCategory,
  type FinancialEntryType,
  type FinancialSystemCategoryKey,
  type Id,
  type SubscriptionTier,
  type WhatsAppConnection,
  tierWhatsAppQuota,
} from "@gestarahub/contracts";

/**
 * Padroes de produto de todo espaco novo (doc 15, fatia 4): categorias
 * financeiras (as de sistema tem id deterministico, o mesmo do gatilho
 * `seed_organization_financial_categories` do banco), conexao assistida do
 * WhatsApp e modelos de mensagem por area. Nao sao dados de demonstracao.
 */

/**
 * Padroes de um espaco novo: categorias financeiras do sistema e a conexao do WhatsApp.
 */

export function timestamps() {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now };
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
  { key: "extras", type: "income", name: "Cobranças avulsas", systemKey: "extras" },
  { key: "courses", type: "income", name: "Cursos", systemKey: "courses" },
  { key: "packages", type: "income", name: "Pacotes de aulas", systemKey: "packages" },
  { key: "products", type: "income", name: "Venda de produtos" },
  { key: "events", type: "income", name: "Eventos e seminários" },
  { key: "graduation", type: "income", name: "Taxa de graduação" },
  { key: "other-income", type: "income", name: "Outras receitas" },
  { key: "teachers", type: "expense", name: "Professores", systemKey: "teachers" },
  { key: "online_fees", type: "expense", name: "Taxas de pagamento online", systemKey: "online_fees" },
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
  return DEFAULT_FINANCIAL_CATEGORIES.map(toFinancialCategory(organizationId));
}

/** Categoria de sistema padrao do tenant pela chave (migracoes do mock). */
export function defaultSystemFinancialCategory(
  organizationId: Id,
  key: FinancialSystemCategoryKey,
): FinancialCategory | undefined {
  const def = DEFAULT_FINANCIAL_CATEGORIES.find((c) => c.systemKey === key);
  return def ? toFinancialCategory(organizationId)(def) : undefined;
}

function toFinancialCategory(organizationId: Id) {
  return (c: (typeof DEFAULT_FINANCIAL_CATEGORIES)[number]): FinancialCategory => ({
    id: `fcat-${organizationId}-${c.key}`,
    organizationId,
    type: c.type,
    name: c.name,
    ...(c.systemKey ? { system: true, systemKey: c.systemKey } : {}),
    status: "active",
    ...timestamps(),
  });
}

/**
 * WhatsApp do espaco: comeca no envio assistido (gratis). A conexao oficial
 * (Pro) e feita pelo espaco, com o proprio numero.
 */
export function defaultWhatsAppConnection(organizationId: Id, tier: SubscriptionTier = "free"): WhatsAppConnection {
  return {
    organizationId,
    officialStatus: "not_connected",
    allowedSendHours: { start: "08:00", end: "20:00" },
    monthlyQuota: { used: 0, included: tierWhatsAppQuota(tier) },
  };
}
