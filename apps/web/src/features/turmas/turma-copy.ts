import { plural } from "@gestarahub/core/format";

/** Vagas no cabeçalho da turma: lotada só quando enche; acima da capacidade diz quantos a mais (achado 35). */
export function capacityLabel(enrolled: number, capacity: number): string {
  if (enrolled > capacity) return `${enrolled} de ${plural(capacity, "aluno", "alunos")} (acima da capacidade)`;
  if (enrolled === capacity) return "Turma lotada";
  return `${enrolled} de ${plural(capacity, "aluno", "alunos")}`;
}

/** Promover da lista de espera: texto sem gênero fixo para o nome do aluno (achado 34). */
export function promoteWaitlistDescription(studentName: string): string {
  return `A matrícula de ${studentName} será feita na turma, mesmo que ela esteja lotada.`;
}
