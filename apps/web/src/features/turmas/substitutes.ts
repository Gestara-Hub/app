import type { Id } from "@gestarahub/contracts";

export interface SubstituteOption {
  id: Id;
  name: string;
  isPrimary: boolean;
  /** Dá aula na modalidade da turma (sem modalidade conhecida, todos contam). */
  teaches: boolean;
}

/**
 * Lista do "Trocar instrutor": o titular primeiro, depois quem leciona a
 * modalidade da turma, por fim os outros (achado 41 do teste de 23/10). Quem não
 * leciona a modalidade continua podendo ser escolhido, com o aviso no nome.
 */
export function substituteOptions(
  professionals: readonly { id: Id; name: string; modalityIds?: readonly Id[] }[],
  modalityId: Id | undefined,
  primaryInstructorId: Id | undefined,
): SubstituteOption[] {
  const options = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    isPrimary: p.id === primaryInstructorId,
    teaches: !modalityId || (p.modalityIds ?? []).includes(modalityId),
  }));
  const rank = (o: SubstituteOption) => (o.isPrimary ? 0 : o.teaches ? 1 : 2);
  return options.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt-BR"));
}

export function substituteLabel(option: SubstituteOption): string {
  if (option.isPrimary) return `${option.name} (titular da turma)`;
  return option.teaches ? option.name : `${option.name} (não dá aula desta modalidade)`;
}
