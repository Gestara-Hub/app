/** Tipos do "Fale com a gente" (conversas do app dos clientes com o assistente e o suporte). */
export type SupportStatus = "bot" | "waiting_us" | "waiting_customer" | "resolved";

/** question: duvida (passa pelo assistente); bug e suggestion vao direto para a equipe. */
export type SupportKind = "question" | "bug" | "suggestion";

export interface SupportThreadSummary {
  id: string;
  /** Número do protocolo (GH-n); veja formatProtocol. */
  number: number;
  kind: SupportKind;
  subject: string;
  status: SupportStatus;
  urgent: boolean;
  createdAt: string;
  lastMessageAt: string;
  unread: number;
  lastPreview: string;
}

export interface SupportMessage {
  id: string;
  author: "customer" | "bot" | "staff" | "system";
  staffName?: string;
  body: string;
  sources?: { title: string; article: string; href?: string }[];
  createdAt: string;
}

export interface SupportThreadView {
  threadId: string;
  /** Número do protocolo (GH-n). */
  number: number;
  kind: SupportKind;
  status: SupportStatus;
  subject: string;
  botHelped: boolean | null;
  messages: SupportMessage[];
  /** O assistente pediu para encaminhar ao suporte (ou nao soube responder). */
  needsHuman: boolean;
  /** O assistente esta ligado e dentro dos limites neste momento. */
  botAvailable: boolean;
}
