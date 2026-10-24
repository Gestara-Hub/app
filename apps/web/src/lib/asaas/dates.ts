import { dateInSpace } from "@gestarahub/core/date";

/**
 * O Asaas conta os dias no horario de Brasilia: as datas que ele manda
 * ("2026-10-21") sao dias de Brasilia, e as que recebe nao podem passar do
 * "hoje" dele. O espaco pode estar em outro fuso (achado 60).
 */
export const ASAAS_TIME_ZONE = "America/Sao_Paulo";

/** "Hoje" do Asaas. */
export function asaasToday(): string {
  return dateInSpace(new Date(), ASAAS_TIME_ZONE);
}

/**
 * Dia do espaco que o Asaas aceita como pagamento "ate hoje": em Fernando de
 * Noronha, das 23h a meia-noite de Brasilia, o dia do espaco ja e o seguinte.
 */
export function notAfterAsaasToday(day: string): string {
  const today = asaasToday();
  return day > today ? today : day;
}
