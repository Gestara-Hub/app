/** Rotulos das acoes da auditoria do painel (texto para a pessoa, sem codigo). */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "auth.login": "Entrou no painel",
  "auth.logout": "Saiu do painel",
  "auth.login_failed": "Tentativa de entrada com senha errada",
  "auth.login_denied": "Entrada recusada (conta sem acesso)",
  "auth.mfa_enrolled": "Configurou o aplicativo autenticador",
  "auth.mfa_failed": "Código do segundo fator errado",
  "admin.created": "Administrador cadastrado",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** Grupos do filtro da tela (prefixo da acao). */
export const AUDIT_GROUPS = [
  { value: "all", label: "Tudo" },
  { value: "auth", label: "Entradas e saídas" },
  { value: "admin", label: "Administradores" },
] as const;
