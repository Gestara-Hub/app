/**
 * Conta de recebimento aberta como pessoa fisica (achado 58, decisao de 24/10):
 * a fatura do parceiro, aberta pelo aluno no link de cartao, mostra CPF, e-mail
 * e telefone de quem abriu a conta. O app nao controla essa fatura; so avisa o
 * dono na ativacao.
 */
export const PERSON_ACCOUNT_NOTICE =
  "Com CPF, a fatura do cartão mostra ao aluno seu CPF, e-mail e telefone. Se você tem CNPJ ou MEI, use ele no lugar.";

/** CPF tem 11 digitos; o aviso so vale para ele. */
export function showsPersonAccountNotice(cpfCnpj: string): boolean {
  return cpfCnpj.replace(/\D/g, "").length === 11;
}
