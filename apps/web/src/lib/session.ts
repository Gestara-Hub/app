/**
 * Sessao mockada do MVP (sem auth real). Um unico cookie marca o usuario como
 * "logado"; a guarda de rota vive em `src/proxy.ts`. Na fase 3 isto sera
 * substituido por auth real, sem mudar as telas.
 */
export const SESSION_COOKIE = "gestarahub_session";

// Valor opaco do cookie de sessao mockada.
export const SESSION_VALUE = "mock-session";

// Duracao do cookie (7 dias).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// Usuario fixo do cenario Corte Nobre (operador de balcao / proprietario).
export const MOCK_USER = {
  name: "Marcelo Andrade",
  role: "Proprietário",
  email: "marcelo@cortenobre.com",
} as const;

export function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
