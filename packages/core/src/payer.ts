import type { Client, StudentGuardian } from "@gestarahub/contracts";

/**
 * Quem paga a cobranca online (decisao de 22/10/2026): o parceiro de
 * pagamentos exige o CPF do pagador. Aluno maior de idade paga com o proprio
 * CPF; menor, com o do responsavel financeiro (o marcado como financeiro ou,
 * sem marca, o primeiro com CPF).
 */

/** So os digitos do CPF. */
export function cpfDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 11);
}

/** CPF valido pelos digitos verificadores (rejeita sequencias como 111.111.111-11). */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** Mascara de digitacao: 000.000.000-00. */
export function formatCpf(value: string | null | undefined): string {
  const digits = cpfDigits(value);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Idade em anos completos na data (AAAA-MM-DD); sem data de nascimento, null. */
export function ageOn(birthDate: string | undefined, today: string): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

export interface OnlinePayer {
  name: string;
  cpf: string;
  phone?: string;
  email?: string;
  /** "student": o proprio aluno; "guardian": o responsavel financeiro. */
  kind: "student" | "guardian";
}

export type PayerResult =
  | { ok: true; payer: OnlinePayer }
  | { ok: false; reason: "student_cpf_missing" | "guardian_cpf_missing" };

function financialGuardian(guardians: StudentGuardian[] | undefined): StudentGuardian | undefined {
  const withCpf = (guardians ?? []).filter((g) => isValidCpf(g.cpf));
  return withCpf.find((g) => g.financial) ?? withCpf[0];
}

/**
 * Pagador da cobranca online. Menor de idade (pela data de nascimento):
 * responsavel financeiro com CPF. Maior ou sem data: o proprio aluno.
 * Telefone e e-mail do responsavel caem para os do aluno quando faltam.
 */
export function resolveOnlinePayer(
  student: Pick<Client, "name" | "cpf" | "phone" | "email" | "birthDate" | "guardians">,
  today: string,
): PayerResult {
  const age = ageOn(student.birthDate, today);
  if (age !== null && age < 18) {
    const guardian = financialGuardian(student.guardians);
    if (!guardian) return { ok: false, reason: "guardian_cpf_missing" };
    return {
      ok: true,
      payer: {
        name: guardian.name,
        cpf: cpfDigits(guardian.cpf),
        phone: guardian.phone || student.phone || undefined,
        email: guardian.email || student.email || undefined,
        kind: "guardian",
      },
    };
  }
  if (!isValidCpf(student.cpf)) return { ok: false, reason: "student_cpf_missing" };
  return {
    ok: true,
    payer: {
      name: student.name,
      cpf: cpfDigits(student.cpf),
      phone: student.phone || undefined,
      email: student.email || undefined,
      kind: "student",
    },
  };
}

/**
 * Quem recebe a cobranca e os avisos de um aluno menor pelo WhatsApp (decisao
 * de 24/10, achado 57): o responsavel financeiro com telefone (o marcado, ou o
 * primeiro com telefone). Maior de idade, sem data de nascimento ou sem
 * responsavel com telefone: `undefined` (vai para o telefone do aluno).
 */
export function messageGuardian(
  student: Pick<Client, "birthDate" | "guardians">,
  today: string,
): { name: string; phone: string } | undefined {
  const age = ageOn(student.birthDate, today);
  if (age === null || age >= 18) return undefined;
  const withPhone = (student.guardians ?? []).filter((g) => Boolean(g.phone?.replace(/\D/g, "")));
  const guardian = withPhone.find((g) => g.financial) ?? withPhone[0];
  return guardian?.phone ? { name: guardian.name, phone: guardian.phone } : undefined;
}

export type PayerIssue = Extract<PayerResult, { ok: false }>["reason"];

/** Mensagem de cada falta de CPF (a mesma na janela "Cobrar online" e na recusa do servidor). */
export function payerIssueMessage(issue: PayerIssue): string {
  return issue === "guardian_cpf_missing"
    ? "Aluno menor de idade: cadastre o CPF do responsável financeiro para cobrar online."
    : "Cadastre o CPF do aluno para cobrar online. O parceiro de pagamentos exige o CPF de quem paga.";
}

/** O que falta para o parceiro aceitar o pagador (sem aluno, falta o CPF dele), ou nada. */
export function payerIssueOf(payer: PayerResult | null): PayerIssue | undefined {
  if (!payer) return "student_cpf_missing";
  return payer.ok ? undefined : payer.reason;
}
