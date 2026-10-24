/**
 * Como o app chama quem dá aula (achado 23 do teste de 23/10). Em turmas a
 * palavra segue a área, como já é com Faixa, Nível e Módulo (Lutas: instrutor;
 * Música e Idiomas: professor); no modelo de agendamento é "profissional".
 * Objetos fixos: referência estável para dependências do React.
 */
export type TeacherTitle = "Instrutor" | "Professor";

export interface TeamWords {
  /** "Instrutor", "Professor", "Profissional". */
  title: string;
  /** "Instrutores"... */
  titlePlural: string;
  /** Meio de frase: "instrutor". */
  lower: string;
  /** "instrutores". */
  lowerPlural: string;
}

function words(title: string, titlePlural: string): TeamWords {
  return { title, titlePlural, lower: title.toLowerCase(), lowerPlural: titlePlural.toLowerCase() };
}

export const INSTRUCTOR_WORDS = words("Instrutor", "Instrutores");
export const TEACHER_WORDS = words("Professor", "Professores");
export const PROFESSIONAL_WORDS = words("Profissional", "Profissionais");

export function teamWordsFor(isClasses: boolean, teacherTitle: TeacherTitle): TeamWords {
  if (!isClasses) return PROFESSIONAL_WORDS;
  return teacherTitle === "Instrutor" ? INSTRUCTOR_WORDS : TEACHER_WORDS;
}
