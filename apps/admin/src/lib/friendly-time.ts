import { ago } from "@/lib/format";

/** "agora" quando faz menos de 1 minuto; senão o mesmo texto de `ago` ("há 3 horas", "Nunca"). */
export function agoFriendly(date: Date | null | undefined): string {
  if (date && Math.abs(Date.now() - date.getTime()) < 60_000) return "agora";
  return ago(date);
}
