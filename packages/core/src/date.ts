/**
 * Fuso do espaco (achados 60 e 76 do teste geral): o servidor roda em UTC e o
 * navegador no fuso da pessoa; "hoje", "agora" e o dia de um instante saem no
 * fuso do espaco. O Brasil tem quatro fusos (sem horario de verao desde 2019):
 * cada espaco guarda o seu em `settings.timeZone`; sem escolha, vale o do estado
 * do endereco da unidade; sem endereco, Brasilia.
 */
export const DEFAULT_SPACE_TIME_ZONE = "America/Sao_Paulo";

/** Os fusos do Brasil, como aparecem para escolher em Configuracoes. */
export const BRAZIL_TIME_ZONES = [
  { id: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
  { id: "America/Sao_Paulo", label: "Brasília (UTC−3)" },
  { id: "America/Manaus", label: "Amazonas, Mato Grosso, MS, Rondônia e Roraima (UTC−4)" },
  { id: "America/Rio_Branco", label: "Acre e oeste do Amazonas (UTC−5)" },
] as const;

export type SpaceTimeZone = (typeof BRAZIL_TIME_ZONES)[number]["id"];

const KNOWN_ZONES = new Set<string>(BRAZIL_TIME_ZONES.map((z) => z.id));

/** Fuso sugerido pelo estado (UF). Fernando de Noronha so por escolha (o estado e PE). */
export function timeZoneForState(state?: string): SpaceTimeZone | undefined {
  const uf = state?.trim().toUpperCase();
  if (!uf) return undefined;
  if (uf === "AC") return "America/Rio_Branco";
  if (["AM", "MT", "MS", "RO", "RR"].includes(uf)) return "America/Manaus";
  return "America/Sao_Paulo";
}

/** Fusos IANA do Brasil e o fuso do GestaraHub que vale para cada um. */
const BRAZIL_IANA_ZONES: Record<string, SpaceTimeZone> = {
  "America/Noronha": "America/Noronha",
  "America/Sao_Paulo": "America/Sao_Paulo",
  "America/Belem": "America/Sao_Paulo",
  "America/Fortaleza": "America/Sao_Paulo",
  "America/Recife": "America/Sao_Paulo",
  "America/Araguaina": "America/Sao_Paulo",
  "America/Maceio": "America/Sao_Paulo",
  "America/Bahia": "America/Sao_Paulo",
  "America/Santarem": "America/Sao_Paulo",
  "America/Manaus": "America/Manaus",
  "America/Campo_Grande": "America/Manaus",
  "America/Cuiaba": "America/Manaus",
  "America/Porto_Velho": "America/Manaus",
  "America/Boa_Vista": "America/Manaus",
  "America/Rio_Branco": "America/Rio_Branco",
  "America/Eirunepe": "America/Rio_Branco",
};

/**
 * Fuso do espaco a partir do fuso do aparelho de quem cria a conta (19/11/2026:
 * sem endereco, todo espaco nascia em Brasilia). Fora do Brasil: nenhum (fica
 * Brasilia ate a pessoa escolher).
 */
export function brazilTimeZoneFor(ianaZone: string | undefined): SpaceTimeZone | undefined {
  return ianaZone ? BRAZIL_IANA_ZONES[ianaZone] : undefined;
}

/** Fuso do aparelho (navegador), ja como um dos fusos do Brasil. */
export function deviceBrazilTimeZone(): SpaceTimeZone | undefined {
  try {
    return brazilTimeZoneFor(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return undefined;
  }
}

/** Fuso do espaco: o escolhido, senao o do estado da unidade, senao Brasilia. */
export function resolveSpaceTimeZone(
  settings?: { timeZone?: string } | null,
  unitAddress?: { state?: string } | string | null,
): SpaceTimeZone {
  const chosen = settings?.timeZone;
  if (chosen && KNOWN_ZONES.has(chosen)) return chosen as SpaceTimeZone;
  const state = typeof unitAddress === "object" && unitAddress ? unitAddress.state : undefined;
  return timeZoneForState(state) ?? DEFAULT_SPACE_TIME_ZONE;
}

/**
 * Quem diz o fuso do espaco "atual": o app liga no inicio (`services/world`,
 * pelo espaco da requisicao no servidor e da sessao no navegador). Sem
 * provedor (scripts, testes do core), Brasilia. Fica no objeto global: pacotes
 * separados do Next teriam cada um a sua copia deste modulo.
 */
interface TimeZoneGlobals {
  provider?: () => string | undefined;
}
const tzGlobals = ((globalThis as { __gestarahubTimeZone?: TimeZoneGlobals }).__gestarahubTimeZone ??= {});

export function setSpaceTimeZoneProvider(provider: (() => string | undefined) | undefined): void {
  tzGlobals.provider = provider;
}

/** Fuso do espaco atual. */
export function currentSpaceTimeZone(): string {
  try {
    const zone = tzGlobals.provider?.();
    return zone && KNOWN_ZONES.has(zone) ? zone : DEFAULT_SPACE_TIME_ZONE;
  } catch {
    return DEFAULT_SPACE_TIME_ZONE;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(date: Date, timeZone: string): Record<string, string> {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatters.set(timeZone, formatter);
  }
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  // Alguns motores escrevem a meia-noite como "24" com `hour12: false`.
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

/**
 * Dia ('YYYY-MM-DD') de um instante no fuso do espaco (o atual, ou o informado),
 * em qualquer ambiente. Sem instante, e "hoje". Data sem hora volta igual.
 */
export function dateInSpace(value: string | Date = new Date(), timeZone: string = currentSpaceTimeZone()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  const p = partsIn(d, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Inicio do dia 'YYYY-MM-DD' no fuso do espaco, como instante ISO (UTC): para
 * filtrar horarios gravados por dia do espaco. Os fusos do Brasil nao tem
 * horario de verao, entao o deslocamento do meio-dia vale para o dia todo.
 */
export function startOfDayInSpace(date: string, timeZone: string = currentSpaceTimeZone()): string {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const p = partsIn(noonUtc, timeZone);
  const offsetMs = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - noonUtc.getTime();
  return new Date(Date.parse(`${date}T00:00:00Z`) - offsetMs).toISOString();
}

/** Fim do dia 'YYYY-MM-DD' no fuso do espaco (ultimo milissegundo), em ISO UTC. */
export function endOfDayInSpace(date: string, timeZone: string = currentSpaceTimeZone()): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = startOfDayInSpace(next.toISOString().slice(0, 10), timeZone);
  return new Date(Date.parse(start) - 1).toISOString();
}

/** Hora ('HH:mm') de um instante no fuso do espaco. */
export function timeInSpace(value: string | Date = new Date(), timeZone: string = currentSpaceTimeZone()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const p = partsIn(d, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** Data de hoje ('YYYY-MM-DD') no fuso do espaco. "Hoje" real da UI e das regras. */
/**
 * "AAAA-MM-DD" de um dia que existe (2026-02-31 nao). Um so validador para os
 * servicos (revisao geral de 31/10/2026: havia quatro copias, e notas e
 * medidas so conferiam o formato).
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function todayISO(): string {
  return dateInSpace(new Date());
}

/** Mes atual ('YYYY-MM') no fuso do espaco. */
export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

/** Hora atual ('HH:mm') no fuso do espaco. */
export function nowTime(): string {
  return timeInSpace(new Date());
}

/**
 * `true` se a data ('YYYY-MM-DD') + horario ('HH:mm') forem anteriores a agora.
 * Compara strings (formato fixo). Sem data, retorna `false` (nada a checar).
 */
export function isPastSlot(date: string | undefined, start: string): boolean {
  if (!date) return false;
  const today = todayISO();
  if (date < today) return true;
  if (date > today) return false;
  return Boolean(start) && start < nowTime();
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function utcDayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Data curta e relativa (pt-BR) para listas e historicos:
 * - "hoje", "ontem", "há 3 dias" (ate 6 dias); no futuro "amanhã", "em 3 dias";
 * - "28 jan" no mesmo ano;
 * - "01/2026" em outro ano.
 * Com `relative: false`, so a forma curta ("28 jan" / "01/2026").
 */
export function relativeDateLabel(
  iso: string,
  opts: { today?: string; relative?: boolean } = {},
): string {
  if (!iso || iso.length < 10) return iso ?? "";
  const today = opts.today ?? todayISO();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (opts.relative !== false) {
    const diff = Math.round((utcDayOf(today) - utcDayOf(iso)) / 86_400_000);
    if (diff === 0) return "hoje";
    if (diff === 1) return "ontem";
    if (diff === -1) return "amanhã";
    if (diff > 1 && diff <= 6) return `há ${diff} dias`;
    if (diff < -1 && diff >= -6) return `em ${-diff} dias`;
  }
  if (y === Number(today.slice(0, 4))) return `${d} ${MONTHS_SHORT[m - 1]}`;
  return `${String(m).padStart(2, "0")}/${y}`;
}

/**
 * Tempo desde um instante, para "Atualizado ..." (pt-BR): "agora mesmo" (menos
 * de 1 minuto), "há 5 min", "há 2 h", "há 3 dias". Instante no futuro (relogio
 * adiantado) conta como agora.
 */
export function elapsedLabel(fromMs: number, nowMs: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, nowMs - fromMs) / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}
