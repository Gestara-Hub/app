/**
 * Contexto técnico que acompanha um problema relatado: navegador, sistema, perfil
 * da pessoa e versão do app. Texto curto, montado no servidor a partir do
 * User-Agent; nada que identifique a pessoa além do perfil.
 */
export function browserName(userAgent: string): string {
  // O Edge e o Opera também dizem "Chrome/" e o Chrome diz "Safari/": vale a marca mais específica primeiro.
  const brands: [RegExp, string][] = [
    [/Edg\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[^]*Safari/, "Safari"],
  ];
  for (const [pattern, name] of brands) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return "Navegador desconhecido";
}

export function systemName(userAgent: string): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  if (/Android/.test(userAgent)) return "Android";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/.test(userAgent)) return "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  return "sistema desconhecido";
}

export function clientInfoText(input: { userAgent: string | null; profile: string; version?: string }): string {
  const ua = input.userAgent ?? "";
  const mobile = /Mobi|Android|iPhone|iPad/.test(ua) ? "celular" : "computador";
  const parts = [`${browserName(ua)} no ${systemName(ua)} (${mobile})`, `perfil ${input.profile}`];
  if (input.version) parts.push(`versão ${input.version}`);
  return parts.join(" · ");
}
