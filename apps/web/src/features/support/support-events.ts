import type { SupportKind } from "@/services/support/supportTypes";

/** Abrir o "Fale com a gente" de qualquer tela (painel de Ajuda, Planos, aviso de erro). */
const EVENT = "gestarahub:open-support";

export interface OpenSupportDetail {
  /** Tipo da conversa nova (problema ou sugestão pulam o assistente). */
  kind?: SupportKind;
  /** Primeira mensagem ja escrita (ex.: dúvida sobre planos). */
  draft?: string;
  /** Codigo do erro que a pessoa viu (liga a conversa ao registro de erros). */
  errorReference?: string;
}

export function openSupport(detail: OpenSupportDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenSupportDetail>(EVENT, { detail }));
}

export function onOpenSupport(handler: (detail: OpenSupportDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<OpenSupportDetail>).detail ?? {});
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
