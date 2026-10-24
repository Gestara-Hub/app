import type { Client } from "@gestarahub/contracts";
import { isMinorConsentPending } from "@/components/shared/minor-consent-badge";

/**
 * Aviso do topo da ficha do aluno menor com o termo pendente. Usa a mesma regra
 * da etiqueta "Termo pendente" da lista (`isMinorConsentPending`), para a ficha
 * nao calar quando a lista avisa (achado 44 do teste de 23/10). Sem pendencia,
 * devolve `null`.
 */
export function minorConsentAlertDetail(
  student: Pick<Client, "birthDate" | "minorConsentStatus" | "guardians">,
): string | null {
  if (!isMinorConsentPending(student)) return null;
  return (student.guardians ?? []).length === 0
    ? "Nenhum responsável cadastrado. Cadastre um em Editar para enviar o termo."
    : "O consentimento dos pais ou responsável ainda não foi confirmado.";
}
