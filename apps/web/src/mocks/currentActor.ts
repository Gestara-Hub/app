import type { AuditActor } from "@gestarahub/contracts";

/**
 * Ator ambiente da sessao (mock). Analogo ao "principal autenticado do request"
 * que o backend real teria via guard/AsyncLocalStorage: quem esta logado agora.
 *
 * Publicado pelo `SessionProvider` (client) quando o usuario logado muda, e lido
 * pelo `auditLogService.record()` para carimbar o autor de cada mutacao — assim
 * os services nao precisam receber o ator por parametro (o que, no backend real,
 * seria ate inseguro: o ator vem do token, nunca do payload do cliente).
 */
let currentActor: AuditActor | null = null;

export function setCurrentActor(actor: AuditActor | null): void {
  currentActor = actor;
}

export function getCurrentActor(): AuditActor | null {
  return currentActor;
}
