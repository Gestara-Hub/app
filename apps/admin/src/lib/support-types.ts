export type ThreadStatus = "bot" | "waiting_us" | "waiting_customer" | "resolved";

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  bot: "Com o assistente",
  waiting_us: "Precisa de resposta",
  waiting_customer: "Aguardando o cliente",
  resolved: "Encerrada",
};

export type ThreadKind = "question" | "bug" | "suggestion";

export const KIND_LABEL: Record<ThreadKind, string> = { question: "Dúvida", bug: "Problema", suggestion: "Sugestão" };

export const KIND_FILTERS: { value: ThreadKind | "all"; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "question", label: "Dúvidas" },
  { value: "bug", label: "Problemas" },
  { value: "suggestion", label: "Sugestões" },
];

export function isThreadKind(value: unknown): value is ThreadKind {
  return value === "question" || value === "bug" || value === "suggestion";
}

/** Andamento de um problema relatado; só conversa do tipo problema tem. */
export type BugStatus = "new" | "investigating" | "fixed" | "cannot_reproduce";

export const BUG_STATUS_LABEL: Record<BugStatus, string> = {
  new: "Novo",
  investigating: "Investigando",
  fixed: "Corrigido",
  cannot_reproduce: "Não reproduzi",
};

export const BUG_STATUSES = Object.keys(BUG_STATUS_LABEL) as BugStatus[];

export function isBugStatus(value: unknown): value is BugStatus {
  return typeof value === "string" && value in BUG_STATUS_LABEL;
}

export type ThreadFilter = "attention" | "waiting_customer" | "bot" | "resolved" | "all";

export const FILTERS: { value: ThreadFilter; label: string }[] = [
  { value: "attention", label: "Precisam de resposta" },
  { value: "waiting_customer", label: "Aguardando o cliente" },
  { value: "bot", label: "Com o assistente" },
  { value: "resolved", label: "Encerradas" },
  { value: "all", label: "Todas" },
];

export function isThreadFilter(value: unknown): value is ThreadFilter {
  return typeof value === "string" && FILTERS.some((f) => f.value === value);
}

export interface ThreadRow {
  id: string;
  /** Número do protocolo (GH-n). */
  number: number;
  kind: ThreadKind;
  /** Andamento do bug (problema sem triagem conta como novo); vazio nos outros tipos. */
  bugStatus: BugStatus | null;
  /** Corrigido, e o erro ligado ao relato aconteceu de novo depois disso. */
  regressed: boolean;
  subject: string;
  status: ThreadStatus;
  urgent: boolean;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  planTier: string | null;
  createdAt: Date;
  lastMessageAt: Date;
  lastCustomerMessageAt: Date | null;
  escalatedAt: Date | null;
}

export interface ThreadMessage {
  id: string;
  author: "customer" | "bot" | "staff" | "system";
  staffName: string | null;
  body: string;
  internal: boolean;
  createdAt: Date;
}

export interface ThreadDetail extends ThreadRow {
  /** Id interno do usuário (o mesmo do registro de erros). */
  userId: string;
  summary: string | null;
  originScreen: string | null;
  errorReference: string | null;
  clientInfo: string | null;
  /** Em que versão (ou texto livre) foi corrigido, e quando. */
  fixedIn: string | null;
  fixedAt: Date | null;
  /** Ocorrências do erro ligado depois da correção; vazio se não voltou ou não há código. */
  regression: { count: number; lastAt: Date; lastRelease: string | null } | null;
  botHelped: boolean | null;
  messages: ThreadMessage[];
}
