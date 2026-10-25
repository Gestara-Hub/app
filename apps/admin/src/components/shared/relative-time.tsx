import { brDay } from "@/lib/format";
import { exactDateTime, relativeDay, relativeTime } from "@/lib/relative-time";

/** Data relativa ("há 9 horas", "em 3 dias") com a data exata, em horário de Brasília, ao passar o mouse. */
export function RelativeTime({ date, empty = "—", className }: { date: Date | null | undefined; empty?: string; className?: string }) {
  if (!date) return <>{empty}</>;
  return (
    <time dateTime={date.toISOString()} title={exactDateTime(date)} className={className}>
      {relativeTime(date)}
    </time>
  );
}

/** Dia civil (AAAA-MM-DD) em forma relativa ("hoje", "amanhã", "há 2 dias"), com a data exata no `title`. */
export function RelativeDay({ day, empty = "—", className }: { day: string | null | undefined; empty?: string; className?: string }) {
  if (!day) return <>{empty}</>;
  return (
    <time dateTime={day} title={brDay(day)} className={className}>
      {relativeDay(day)}
    </time>
  );
}
