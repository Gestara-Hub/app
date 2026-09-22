import { store } from "@/mocks/store";

/**
 * Substantivos que mudam com o modelo do tenant, para mensagens e auditoria:
 * na academia (turmas) cliente e "aluno" e categoria e "modalidade".
 */
export function clientNoun(): string {
  return store.organization.model === "classes" ? "aluno" : "cliente";
}

export function categoryNoun(): string {
  return store.organization.model === "classes" ? "modalidade" : "categoria";
}
