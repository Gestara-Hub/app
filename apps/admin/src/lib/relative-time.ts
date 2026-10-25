import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Datas do painel sempre em forma relativa ("há 5 minutos", "em 3 dias", "hoje"); a data exata
 * (em horário de Brasília) fica no `title` do `<RelativeTime>`. Funções puras e testadas.
 */
const TIME_ZONE = "America/Sao_Paulo";

/** "agora" quando a diferença é menor que 1 minuto (nunca "há 0 segundos"); senão "há 5 minutos" ou "em 5 minutos". */
export function relativeTime(date: Date, now: Date = new Date()): string {
  if (Math.abs(now.getTime() - date.getTime()) < 60_000) return "agora";
  return formatDistanceStrict(date, now, { locale: ptBR, addSuffix: true });
}

const DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const EXACT = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Data e hora exatas em Brasília: "25/10/2026 11:16:32" (dica ao passar o mouse). */
export const exactDateTime = (date: Date): string => EXACT.format(date).replace(",", "");

const dayNumber = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Dia civil (AAAA-MM-DD) de uma data, em Brasília. */
export const brasiliaDay = (date: Date): string => DAY.format(date);

/** Para um dia civil ("2026-10-25"): "hoje", "amanhã", "ontem", "em 5 dias", "há 2 dias", "em 2 meses"... */
export function relativeDay(day: string, now: Date = new Date()): string {
  const diff = dayNumber(day) - dayNumber(brasiliaDay(now));
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  const abs = Math.abs(diff);
  const unit = abs < 30 ? `${abs} ${abs === 1 ? "dia" : "dias"}` : abs < 365 ? `${Math.round(abs / 30.44)} ${Math.round(abs / 30.44) === 1 ? "mês" : "meses"}` : `${Math.round(abs / 365.25)} ${Math.round(abs / 365.25) === 1 ? "ano" : "anos"}`;
  return diff > 0 ? `em ${unit}` : `há ${unit}`;
}
