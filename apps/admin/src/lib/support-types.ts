export type ThreadStatus = "bot" | "waiting_us" | "waiting_customer" | "resolved";

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  bot: "Com o assistente",
  waiting_us: "Precisa de resposta",
  waiting_customer: "Aguardando o cliente",
  resolved: "Encerrada",
};

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
  summary: string | null;
  originScreen: string | null;
  errorReference: string | null;
  botHelped: boolean | null;
  messages: ThreadMessage[];
}
