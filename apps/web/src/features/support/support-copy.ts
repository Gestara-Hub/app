import type { SupportKind, SupportStatus } from "@/services/support/supportTypes";

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

export const KIND_LABEL: Record<SupportKind, string> = {
  question: "Dúvida",
  bug: "Problema",
  suggestion: "Sugestão",
};

/** Texto de abertura e dica do campo, por tipo de conversa nova. */
export const KIND_COPY: Record<SupportKind, { intro: string; placeholder: string }> = {
  question: {
    intro:
      "Conte o que você precisa. O assistente responde com base na ajuda do GestaraHub e, se não resolver, você envia para o suporte. Não escreva CPF, cartão nem senha: por segurança, esses dados são apagados da mensagem.",
    placeholder: "Escreva sua mensagem",
  },
  bug: {
    intro:
      "Conte o que você tentou fazer e o que aconteceu. Vai direto para a nossa equipe, e a tela em que você está já vai junto. Não escreva CPF, cartão nem senha.",
    placeholder: "O que aconteceu? O que você esperava?",
  },
  suggestion: {
    intro:
      "Conte o que melhoraria no layout ou no jeito de usar. Vai direto para a nossa equipe, e lemos todas. Não escreva CPF, cartão nem senha.",
    placeholder: "Qual melhoria você sugere?",
  },
};

export const DIRECT_QUESTION_INTRO =
  "Conte o que você precisa. Sua mensagem vai direto para a nossa equipe, que responde em até 2 dias úteis por aqui e por e-mail. Não escreva CPF, cartão nem senha: por segurança, esses dados são apagados da mensagem.";

export function supportIntro(kind: SupportKind, botAvailable: boolean): string {
  if (kind === "question" && !botAvailable) return DIRECT_QUESTION_INTRO;
  return KIND_COPY[kind].intro;
}
