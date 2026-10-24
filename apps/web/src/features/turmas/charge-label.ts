const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

interface ChargeLabelInput {
  kind: string;
  competence?: string;
  description?: string;
  cycleIndex?: number;
  cycleTotal?: number;
  dueDate: string;
}

/**
 * Nome curto da cobrança para leitor de tela: "mensalidade out/2026",
 * "parcela 2 de 4 do curso Confeitaria". Os botões de cada linha diziam só o
 * nome do aluno, igual em todas as cobranças dele (achado 46).
 */
export function chargeAccessibleLabel(charge: ChargeLabelInput): string {
  if (charge.kind === "membership") {
    const [year, month] = (charge.competence ?? charge.dueDate.slice(0, 7)).split("-");
    return `mensalidade ${MONTHS[Number(month) - 1] ?? month}/${year}`;
  }
  if (charge.kind === "dropin") return `aula avulsa de ${charge.dueDate.slice(8, 10)}/${charge.dueDate.slice(5, 7)}`;
  const noun = charge.kind === "course" ? "curso" : charge.kind === "package" ? "pacote" : "cobrança";
  const what = `${noun} ${charge.description ?? ""}`.trim();
  const installment = (charge.cycleTotal ?? 1) > 1 ? `parcela ${charge.cycleIndex ?? 1} de ${charge.cycleTotal} do ` : "";
  return installment ? `${installment}${what}` : what;
}

/** Aviso extra ao cancelar a cobrança que tem Pix ou link em aberto (achado 64). */
export function cancelOpenCodeNote(hasOpenOnlineCode: boolean): string | null {
  return hasOpenOnlineCode ? "O Pix ou o link já enviado ao aluno deixa de funcionar." : null;
}
