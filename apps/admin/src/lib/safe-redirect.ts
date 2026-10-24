/** So caminho relativo do painel (barra "//evil.com", esquemas e a propria tela de login). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value === "/login" || value.startsWith("/login/") || value.startsWith("/mfa")) return "/";
  return value;
}
