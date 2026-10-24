/**
 * Subtitulo da tela Equipe. No modelo de turmas o horario vem da turma, entao a
 * tela nao promete "disponibilidade de cada um" (achado 22 do teste de 23/10).
 */
export function teamSubtitle(isClasses: boolean): string {
  return isClasses
    ? "Quem dá aula na unidade."
    : "Profissionais da unidade e a disponibilidade de cada um.";
}
