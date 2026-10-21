import type { AuditActor } from "@gestarahub/contracts";

/**
 * Quem esta agindo (doc 15). No servidor vem da sessao da requisicao
 * (`scope.ts`); fora dele, do `SessionProvider` (barbearia de demonstracao) ou
 * do setup dos testes. Os servicos usam para a auditoria e o escopo do
 * professor, nunca recebem o ator por parametro.
 */

let currentActor: AuditActor | null = null;
let scopedActor: (() => AuditActor | undefined) | null = null;

export function setActorScopeResolver(resolver: () => AuditActor | undefined): void {
  scopedActor = resolver;
}

export function setCurrentActor(actor: AuditActor | null): void {
  currentActor = actor;
}

export function getCurrentActor(): AuditActor | null {
  return scopedActor?.() ?? currentActor;
}
