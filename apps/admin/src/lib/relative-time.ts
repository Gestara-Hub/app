import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

/** "há 5 minutos", ou "agora" quando faz menos de 1 minuto (nunca "há 0 segundos"). */
export function agoOrNow(date: Date, now: Date = new Date()): string {
  if (Math.abs(now.getTime() - date.getTime()) < 60_000) return "agora";
  return formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true });
}
