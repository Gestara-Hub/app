import type { StudentPackageStatus } from "@gestarahub/contracts";

/**
 * Acoes do pacote do aluno (lista de Alunos e aba Pacotes da ficha). Vender
 * nunca depende dos pacotes que o aluno ja tem: com um em uso nas mesmas
 * modalidades, a venda renova (regra 6, doc 20); cancelado ou renovado nao
 * trava nada. So o aluno precisa estar ativo.
 */
export interface PackageActionFacts {
  status: StudentPackageStatus;
  lessonsUsed: number;
  usages: readonly unknown[];
  purchasedAt: string;
  createdAt: string;
}

/** Pode vender um pacote ao aluno (qualquer que seja o pacote atual). */
export function canSellPackageTo(student: { status: string }): boolean {
  return student.status === "active";
}

/** Desfazer a venda: em uso e sem aula usada (a mesma regra do servico). */
export function canCancelPackage(pkg: PackageActionFacts): boolean {
  return pkg.status === "active" && pkg.lessonsUsed === 0 && pkg.usages.length === 0;
}

/** Renovar abre a venda com o mesmo pacote: so o que esta em uso. */
export function canRenewPackage(pkg: PackageActionFacts): boolean {
  return pkg.status === "active";
}

/** Pacote que o menu do aluno cancela: o mais recente que ainda pode ser cancelado. */
export function cancelablePackage<T extends PackageActionFacts>(packages: readonly T[]): T | undefined {
  return [...packages]
    .filter(canCancelPackage)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt))[0];
}
