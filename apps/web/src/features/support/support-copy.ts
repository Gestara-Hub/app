import type { SupportStatus } from "@/services/support/supportTypes";

/** Textos da tela de suporte (sem logica de tela, para testar). */
export const STATUS_LABEL: Record<SupportStatus, string> = {
  bot: "Com o assistente",
  waiting_us: "Com o suporte",
  waiting_customer: "O suporte respondeu",
  resolved: "Encerrada",
};

export const REPLY_PROMISE = "Respondemos em até 2 dias úteis, por aqui e por e-mail.";

export function statusNote(status: SupportStatus): string | null {
  switch (status) {
    case "waiting_us":
      return `Sua conversa está com o suporte. ${REPLY_PROMISE}`;
    case "waiting_customer":
      return "O suporte respondeu. Escreva abaixo para continuar.";
    case "resolved":
      return "Conversa encerrada. Escreva abaixo se precisar de mais ajuda.";
    default:
      return null;
  }
}

export function authorLabel(author: "customer" | "bot" | "staff" | "system", staffName?: string): string {
  if (author === "customer") return "Você";
  if (author === "bot") return "Assistente";
  if (author === "staff") return staffName ? `Suporte · ${staffName}` : "Suporte";
  return "";
}
