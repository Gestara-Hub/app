import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  AnyCertificate,
  CertificateAccentColor,
  CertificateKind,
  GraduationCertificate,
  CertificateArtwork,
  CertificateBlock,
  CertificateInk,
  CertificateLogoSize,
  CertificateQrSize,
  CertificateLayout,
  CertificatePart,
  CertificateSignature,
  CertificateTemplate,
  CertificateTextPosition,
  ClassesBusinessSegment,
  CourseCertificate,
  DateISO,
  Id,
  TimeISO,
} from "@gestarahub/contracts";

/**
 * Certificado de conclusao do curso (doc 20, fase D; gerador de modelos no
 * doc 21, secao 1). Duas partes separadas: os DADOS (`buildCourseCertificate`,
 * o que a API devolve) e o TEXTO do modelo do espaco (`renderCertificate`, que
 * troca as variaveis). O desenho (layout, cor, logo) fica na tela.
 */

const brDate = (iso: DateISO) => format(parseISO(iso), "dd/MM/yyyy");

/**
 * Aulas do curso: cada encontro semanal entre o inicio e o fim, inclusive
 * (dois encontros no mesmo dia da semana contam dois). Fim antes do inicio = 0.
 */
export function countCourseLessons(startDate: DateISO, endDate: DateISO, weekdays: readonly number[]): number {
  if (endDate < startDate || weekdays.length === 0) return 0;
  return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).reduce(
    (sum, day) => sum + weekdays.filter((w) => w === getDay(day)).length,
    0,
  );
}

/** Frequencia em % inteiro: presencas / (presencas + faltas). Sem chamada = null. */
export function attendancePercent(present: number, absent: number): number | null {
  const total = present + absent;
  return total > 0 ? Math.round((present / total) * 100) : null;
}

/** Minutos de "HH:mm" a "HH:mm" (fim antes do inicio = 0). */
function slotMinutes(start: TimeISO, end: TimeISO): number {
  const toMinutes = (time: TimeISO) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

export interface CourseMeetingSlot {
  /** Dia da semana (0 = domingo). */
  weekday: number;
  start: TimeISO;
  end: TimeISO;
}

/** Carga horaria do curso em minutos: duracao de cada aula entre o inicio e o fim. */
export function countCourseWorkloadMinutes(
  startDate: DateISO,
  endDate: DateISO,
  slots: readonly CourseMeetingSlot[],
): number {
  return slots.reduce(
    (sum, slot) => sum + countCourseLessons(startDate, endDate, [slot.weekday]) * slotMinutes(slot.start, slot.end),
    0,
  );
}

/** Minutos -> "16 horas", "1 hora", "12h30", "45 minutos". Zero = "". */
export function formatWorkload(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} ${m === 1 ? "minuto" : "minutos"}`;
  if (m === 0) return `${h} ${h === 1 ? "hora" : "horas"}`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export interface CourseCertificateInput {
  enrollmentId: Id;
  classGroupId: Id;
  organizationName: string;
  studentName: string;
  courseName: string;
  modalityName?: string;
  startDate: DateISO;
  endDate: DateISO;
  /** Encontros semanais da turma (dia da semana e horario). */
  meetingSlots: readonly CourseMeetingSlot[];
  presentCount: number;
  absentCount: number;
  instructorName: string;
  city?: string;
  issuedOn: DateISO;
}

export function buildCourseCertificate(input: CourseCertificateInput): CourseCertificate {
  const city = input.city?.trim();
  return {
    enrollmentId: input.enrollmentId,
    classGroupId: input.classGroupId,
    organizationName: input.organizationName.trim(),
    studentName: input.studentName.trim(),
    courseName: input.courseName.trim(),
    ...(input.modalityName ? { modalityName: input.modalityName } : {}),
    startDate: input.startDate,
    endDate: input.endDate,
    lessonsCount: countCourseLessons(
      input.startDate,
      input.endDate,
      input.meetingSlots.map((slot) => slot.weekday),
    ),
    workloadMinutes: countCourseWorkloadMinutes(input.startDate, input.endDate, input.meetingSlots),
    attendancePercent: attendancePercent(input.presentCount, input.absentCount),
    instructorName: input.instructorName.trim(),
    ...(city ? { city } : {}),
    issuedOn: input.issuedOn,
  };
}

export interface GraduationCertificateInput {
  promotionId: Id;
  studentId: Id;
  modalityId: Id;
  organizationName: string;
  studentName: string;
  modalityName: string;
  levelName: string;
  previousLevelName?: string;
  /** Grau dentro da etapa (0 = nenhum). */
  subLevel?: number;
  /** Trilha de faixas: o grau entra no certificado ("2º grau"); nas outras, nao. */
  beltStyle?: boolean;
  graduatedOn: DateISO;
  instructorName: string;
  city?: string;
  issuedOn: DateISO;
}

/** Dados do certificado de graduacao (doc 21 §1.6), a partir do registro do historico. */
export function buildGraduationCertificate(input: GraduationCertificateInput): GraduationCertificate {
  const city = input.city?.trim();
  const previous = input.previousLevelName?.trim();
  const degree = input.beltStyle && input.subLevel && input.subLevel > 0 ? `${input.subLevel}º grau` : undefined;
  return {
    promotionId: input.promotionId,
    studentId: input.studentId,
    modalityId: input.modalityId,
    organizationName: input.organizationName.trim(),
    studentName: input.studentName.trim(),
    modalityName: input.modalityName.trim(),
    levelName: input.levelName.trim(),
    ...(previous ? { previousLevelName: previous } : {}),
    ...(degree ? { degree } : {}),
    graduatedOn: input.graduatedOn,
    instructorName: input.instructorName.trim(),
    ...(city ? { city } : {}),
    issuedOn: input.issuedOn,
  };
}

// --- Modelo do certificado (variaveis e texto) -----------------------------

export const CERTIFICATE_LAYOUTS = ["classic", "modern", "minimal", "custom"] as const satisfies readonly CertificateLayout[];

export const CERTIFICATE_TEXT_POSITIONS = ["top", "center", "bottom"] as const satisfies readonly CertificateTextPosition[];
export const CERTIFICATE_INKS = ["dark", "light"] as const satisfies readonly CertificateInk[];
export const CERTIFICATE_PARTS = [
  "logo",
  "organizationName",
  "title",
  "body",
  "date",
  "signatures",
] as const satisfies readonly CertificatePart[];

export const CERTIFICATE_BLOCKS = ["logo", "text", "signatures", "verification"] as const satisfies readonly CertificateBlock[];
export const CERTIFICATE_LOGO_SIZES = ["small", "medium", "large"] as const satisfies readonly CertificateLogoSize[];
export const CERTIFICATE_QR_SIZES = ["small", "normal"] as const satisfies readonly CertificateQrSize[];

/** Posicao dentro da folha: x e y em % (0 a 100), com 2 casas no maximo. */
export function isSheetPosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return [x, y].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100);
}

/** Ajustes iniciais da arte (texto no centro, escuro, tudo aparecendo). */
export function defaultCertificateArtwork(fileId: string): CertificateArtwork {
  return { fileId, textPosition: "center", ink: "dark", hidden: [] };
}

export const CERTIFICATE_ACCENT_COLORS = [
  "graphite",
  "navy",
  "green",
  "wine",
  "gold",
  "purple",
] as const satisfies readonly CertificateAccentColor[];

/** Cor de cada opcao (tela, impressao e PDF). */
export const CERTIFICATE_ACCENT_HEX: Record<CertificateAccentColor, string> = {
  graphite: "#3f3f46",
  navy: "#1e3a8a",
  green: "#166534",
  wine: "#881337",
  gold: "#a16207",
  purple: "#5b21b6",
};

/** Variaveis aceitas no titulo, no texto e nos nomes das assinaturas. */
export const CERTIFICATE_VARIABLES = [
  "aluno",
  "curso",
  "inicio",
  "fim",
  "aulas",
  "carga_horaria",
  "frequencia",
  "professor",
  "empresa",
  "cidade",
  "data",
] as const;

export type CertificateVariable = (typeof CERTIFICATE_VARIABLES)[number];

/** Variaveis do certificado de graduacao (doc 21 §1.6): sem curso, aulas, frequencia e carga horaria. */
export const GRADUATION_CERTIFICATE_VARIABLES = [
  "aluno",
  "modalidade",
  "etapa",
  "etapa_anterior",
  "grau",
  "data",
  "professor",
  "empresa",
  "cidade",
] as const;

export type GraduationCertificateVariable = (typeof GRADUATION_CERTIFICATE_VARIABLES)[number];
export type CertificateVariableName = CertificateVariable | GraduationCertificateVariable;

/** As variaveis que o modelo de cada tipo aceita. */
export function certificateVariablesFor(kind: CertificateKind = "course"): readonly CertificateVariableName[] {
  return kind === "graduation" ? GRADUATION_CERTIFICATE_VARIABLES : CERTIFICATE_VARIABLES;
}

export function isGraduationCertificate(cert: AnyCertificate): cert is GraduationCertificate {
  return "promotionId" in cert;
}

export const CERTIFICATE_LIMITS = {
  title: 60,
  body: 600,
  signatureText: 60,
  maxSignatures: 2,
} as const;

export const DEFAULT_CERTIFICATE_TITLE = "Certificado de conclusão";

/**
 * Texto padrao. "Que teve 7 aulas" diz o tamanho do curso (nao as presencas do
 * aluno) e a frequencia real vem ao lado (achado 48). Curso de um dia vira
 * "em ..."; sem frequencia, o trecho sai.
 */
export const DEFAULT_CERTIFICATE_BODY =
  "Certificamos que {aluno} concluiu o curso {curso}, de {inicio} a {fim}, que teve {aulas}, com frequência de {frequencia}.";

export const DEFAULT_CERTIFICATE_SIGNATURES: readonly CertificateSignature[] = [
  { name: "{professor}", role: "Instrutor" },
  { name: "{empresa}", role: "Responsável" },
];

/**
 * Modelo pronto de uma area (doc 21 §1.5, 31/10/2026): layout, cor, titulo,
 * texto e o cargo de quem assina pelo espaco. O professor assina com a palavra
 * do espaco (`teacherTitle`). O espaco que nunca salvou o proprio modelo ja
 * emite com o da sua area; na tela, a galeria "Comece por um modelo" troca.
 */
export interface CertificatePreset {
  layout: CertificateLayout;
  accentColor: CertificateAccentColor;
  title: string;
  body: string;
  /** Cargo da assinatura do espaco ("{empresa}"). */
  spaceRole: string;
  /** Uma linha na galeria. */
  description: string;
}

/**
 * Cada area tem titulo e texto no tom dela (31/10/2026: "o que se escreve numa
 * graduacao de artes marciais e diferente de uma escola de culinaria"). Os
 * trechos sem variavel ficam sempre; os com variavel sem valor saem sozinhos.
 */
export const CERTIFICATE_PRESETS: Record<ClassesBusinessSegment, CertificatePreset> = {
  martial_arts: {
    layout: "classic",
    accentColor: "wine",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} concluiu o curso {curso}, de {inicio} a {fim}, somando {carga_horaria} de treino, com frequência de {frequencia}, demonstrando disciplina, respeito e dedicação nos treinos.",
    spaceRole: "Responsável",
    description: "Moldura clássica, vinho, disciplina e treino",
  },
  pilates_yoga: {
    layout: "minimal",
    accentColor: "green",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} participou e concluiu o curso {curso}, realizado de {inicio} a {fim}, com {carga_horaria} de prática orientada e frequência de {frequencia}, cultivando consciência corporal e presença em cada aula.",
    spaceRole: "Responsável",
    description: "Limpo, verde, prática e consciência corporal",
  },
  functional_training: {
    layout: "modern",
    accentColor: "graphite",
    title: "Certificado",
    body: "{aluno} completou o programa {curso}, de {inicio} a {fim}: {aulas} de treino, {carga_horaria} no total e frequência de {frequencia}. Programa concluído com constância e superação.",
    spaceRole: "Responsável",
    description: "Moderno, grafite, direto e motivador",
  },
  dance: {
    layout: "modern",
    accentColor: "purple",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} concluiu o curso {curso}, de {inicio} a {fim}, com {carga_horaria} de aulas e frequência de {frequencia}, com ritmo, presença e expressão em cada ensaio.",
    spaceRole: "Direção",
    description: "Moderno, roxo, ritmo e expressão",
  },
  music: {
    layout: "classic",
    accentColor: "navy",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} concluiu o curso {curso}, com carga horária de {carga_horaria}, realizado de {inicio} a {fim}, com frequência de {frequencia} e aproveitamento nas aulas e nas apresentações.",
    spaceRole: "Direção",
    description: "Clássico, azul, aulas e apresentações",
  },
  languages: {
    layout: "classic",
    accentColor: "navy",
    title: "Certificado de conclusão de curso",
    body: "Certificamos que {aluno} concluiu com aproveitamento o curso {curso}, com carga horária de {carga_horaria}, no período de {inicio} a {fim}, com frequência de {frequencia}.",
    spaceRole: "Direção",
    description: "Clássico, azul, formal e com aproveitamento",
  },
  swimming_sports: {
    layout: "modern",
    accentColor: "navy",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} concluiu o curso {curso}, de {inicio} a {fim}, com {aulas} e frequência de {frequencia}, cumprindo as etapas previstas para o nível.",
    spaceRole: "Direção",
    description: "Moderno, azul, etapas do nível",
  },
  gastronomy: {
    layout: "classic",
    accentColor: "gold",
    title: "Certificado de conclusão de curso",
    body: "Certificamos que {aluno} concluiu o curso {curso}, com carga horária de {carga_horaria}, realizado de {inicio} a {fim}, com frequência de {frequencia}, dominando as técnicas e as receitas do programa.",
    spaceRole: "Responsável",
    description: "Clássico, dourado, técnicas e receitas",
  },
  arts_crafts: {
    layout: "minimal",
    accentColor: "wine",
    title: "Certificado de conclusão",
    body: "Certificamos que {aluno} concluiu o curso {curso}, realizado de {inicio} a {fim}, com carga horária de {carga_horaria}, desenvolvendo as técnicas trabalhadas no ateliê.",
    spaceRole: "Responsável",
    description: "Limpo, vinho, técnicas do ateliê",
  },
  beauty_courses: {
    layout: "minimal",
    accentColor: "gold",
    title: "Certificado de curso livre",
    body: "Certificamos que {aluno} concluiu o curso livre {curso}, com carga horária de {carga_horaria}, realizado de {inicio} a {fim}, com frequência de {frequencia} e aproveitamento nas atividades práticas.",
    spaceRole: "Responsável",
    description: "Limpo, dourado, curso livre e prática",
  },
  // Sem area definida (ou "Outra area"): o texto padrao de sempre.
  custom: {
    layout: "classic",
    accentColor: "graphite",
    title: DEFAULT_CERTIFICATE_TITLE,
    body: DEFAULT_CERTIFICATE_BODY,
    spaceRole: "Responsável",
    description: "Clássico, grafite, texto padrão",
  },
};

/** Modelo a partir de um modelo pronto (sem logo nem arte). */
export function certificateTemplateFromPreset(preset: CertificatePreset, teacherTitle = "Instrutor"): CertificateTemplate {
  return {
    layout: preset.layout,
    accentColor: preset.accentColor,
    title: preset.title,
    body: preset.body,
    signatures: [
      { name: "{professor}", role: teacherTitle },
      { name: "{empresa}", role: preset.spaceRole },
    ],
    showAttendance: true,
  };
}

/**
 * Modelo padrao (o espaco que nunca salvou o proprio): o modelo pronto da area
 * do espaco, ou o generico sem area. `teacherTitle` e a palavra do espaco para
 * quem da aula ("Instrutor" ou "Professor").
 */
export function defaultCertificateTemplate(teacherTitle = "Instrutor", segment?: ClassesBusinessSegment): CertificateTemplate {
  return certificateTemplateFromPreset(CERTIFICATE_PRESETS[segment ?? "custom"], teacherTitle);
}

export const DEFAULT_GRADUATION_CERTIFICATE_TITLE = "Certificado de graduação";
export const DEFAULT_GRADUATION_CERTIFICATE_BODY =
  "Certificamos que {aluno} alcançou {etapa} em {modalidade}, em {data}, por avaliação de {professor}.";

/**
 * Modelos prontos do certificado de graduacao (doc 21 §1.6), um por area: a
 * palavra da trilha ja vem no nome da etapa ("Faixa Azul", "Nível 2"), entao o
 * texto fala em "{etapa}" e cada area poe o tom (faixa, nivel, modulo ou fase).
 */
export const GRADUATION_CERTIFICATE_PRESETS: Record<ClassesBusinessSegment, CertificatePreset> = {
  martial_arts: {
    layout: "classic",
    accentColor: "wine",
    title: "Certificado de graduação",
    body: "Certificamos que {aluno} conquistou a {etapa} de {modalidade}, {grau}, em {data}, sob avaliação de {professor}, por mérito, disciplina e dedicação aos treinos.",
    spaceRole: "Responsável",
    description: "Moldura clássica, vinho, mérito e disciplina",
  },
  pilates_yoga: {
    layout: "minimal",
    accentColor: "green",
    title: "Certificado de nível",
    body: "Certificamos que {aluno} alcançou {etapa} em {modalidade}, em {data}, com consciência corporal e presença em cada prática.",
    spaceRole: "Responsável",
    description: "Limpo, verde, consciência corporal",
  },
  functional_training: {
    layout: "modern",
    accentColor: "graphite",
    title: "Certificado",
    body: "{aluno} alcançou {etapa} em {modalidade} em {data}. Nível conquistado com constância e superação.",
    spaceRole: "Responsável",
    description: "Moderno, grafite, direto e motivador",
  },
  dance: {
    layout: "modern",
    accentColor: "purple",
    title: "Certificado de nível",
    body: "Certificamos que {aluno} alcançou {etapa} em {modalidade}, em {data}, com ritmo, presença e expressão em cada ensaio.",
    spaceRole: "Direção",
    description: "Moderno, roxo, ritmo e expressão",
  },
  music: {
    layout: "classic",
    accentColor: "navy",
    title: "Certificado de conclusão de módulo",
    body: "Certificamos que {aluno} concluiu {etapa} de {modalidade} em {data}, com aproveitamento nas aulas e nas apresentações, sob orientação de {professor}.",
    spaceRole: "Direção",
    description: "Clássico, azul, aulas e apresentações",
  },
  languages: {
    layout: "classic",
    accentColor: "navy",
    title: "Certificado de conclusão de nível",
    body: "Certificamos que {aluno} concluiu com aproveitamento {etapa} de {modalidade} em {data}, sob orientação de {professor}.",
    spaceRole: "Direção",
    description: "Clássico, azul, formal e com aproveitamento",
  },
  swimming_sports: {
    layout: "modern",
    accentColor: "navy",
    title: "Certificado de fase",
    body: "Certificamos que {aluno} concluiu {etapa} de {modalidade} em {data}, cumprindo as etapas previstas, sob orientação de {professor}.",
    spaceRole: "Direção",
    description: "Moderno, azul, etapas cumpridas",
  },
  gastronomy: {
    layout: "classic",
    accentColor: "gold",
    title: "Certificado de conclusão de módulo",
    body: "Certificamos que {aluno} concluiu {etapa} de {modalidade} em {data}, dominando as técnicas e as receitas do módulo, sob orientação de {professor}.",
    spaceRole: "Responsável",
    description: "Clássico, dourado, técnicas e receitas",
  },
  arts_crafts: {
    layout: "minimal",
    accentColor: "wine",
    title: "Certificado de conclusão de módulo",
    body: "Certificamos que {aluno} concluiu {etapa} de {modalidade} em {data}, desenvolvendo as técnicas trabalhadas no ateliê.",
    spaceRole: "Responsável",
    description: "Limpo, vinho, técnicas do ateliê",
  },
  beauty_courses: {
    layout: "minimal",
    accentColor: "gold",
    title: "Certificado de conclusão de módulo",
    body: "Certificamos que {aluno} concluiu {etapa} de {modalidade} em {data}, com aproveitamento nas atividades práticas, sob orientação de {professor}.",
    spaceRole: "Responsável",
    description: "Limpo, dourado, prática e aproveitamento",
  },
  custom: {
    layout: "classic",
    accentColor: "graphite",
    title: DEFAULT_GRADUATION_CERTIFICATE_TITLE,
    body: DEFAULT_GRADUATION_CERTIFICATE_BODY,
    spaceRole: "Responsável",
    description: "Clássico, grafite, texto padrão",
  },
};

/** Modelo padrao do certificado de graduacao: o da area do espaco, ou o generico. */
export function defaultGraduationCertificateTemplate(teacherTitle = "Instrutor", segment?: ClassesBusinessSegment): CertificateTemplate {
  return certificateTemplateFromPreset(GRADUATION_CERTIFICATE_PRESETS[segment ?? "custom"], teacherTitle);
}

/** Os modelos prontos de cada tipo. */
export function certificatePresetsFor(kind: CertificateKind): Record<ClassesBusinessSegment, CertificatePreset> {
  return kind === "graduation" ? GRADUATION_CERTIFICATE_PRESETS : CERTIFICATE_PRESETS;
}

const VARIABLE_RE = /\{(\w+)\}/g;

/** Variaveis do texto que nao existem no tipo (sem repetir, na ordem em que aparecem). */
export function unknownCertificateVariables(text: string, kind: CertificateKind = "course"): string[] {
  const known = new Set<string>(certificateVariablesFor(kind));
  const unknown: string[] = [];
  for (const [, key] of text.matchAll(VARIABLE_RE)) {
    if (!known.has(key) && !unknown.includes(key)) unknown.push(key);
  }
  return unknown;
}

export type CertificateValues = Partial<Record<CertificateVariableName, string>>;

const longDate = (iso: DateISO) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/** Valores das variaveis do certificado de graduacao. `{data}` e o dia da graduacao. */
export function graduationCertificateVariableValues(cert: GraduationCertificate): CertificateValues {
  const or = (value?: string) => value?.trim() || undefined;
  return {
    aluno: or(cert.studentName),
    modalidade: or(cert.modalityName),
    etapa: or(cert.levelName),
    etapa_anterior: or(cert.previousLevelName),
    grau: or(cert.degree),
    data: longDate(cert.graduatedOn),
    professor: or(cert.instructorName),
    empresa: or(cert.organizationName),
    cidade: or(cert.city),
  };
}

/** Valores das variaveis para um certificado. Sem valor = `undefined`. */
export function certificateVariableValues(
  cert: CourseCertificate,
  options: { showAttendance?: boolean } = {},
): CertificateValues {
  const showAttendance = options.showAttendance ?? true;
  const or = (value?: string) => value?.trim() || undefined;
  return {
    aluno: or(cert.studentName),
    curso: or(cert.courseName),
    inicio: brDate(cert.startDate),
    fim: brDate(cert.endDate),
    aulas: cert.lessonsCount > 0 ? `${cert.lessonsCount} ${cert.lessonsCount === 1 ? "aula" : "aulas"}` : undefined,
    carga_horaria: or(formatWorkload(cert.workloadMinutes)),
    frequencia:
      showAttendance && cert.attendancePercent !== null ? `${cert.attendancePercent}%` : undefined,
    professor: or(cert.instructorName),
    empresa: or(cert.organizationName),
    cidade: or(cert.city),
    data: format(parseISO(cert.issuedOn), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
  };
}

/** Marca de variavel sem valor (nao aparece em texto digitado). */
const MISSING = "\u0000";
const SENTENCE_END_RE = /[.!?…]+$/;
const CONNECTORS = [", ", " e "] as const;

function lastConnectorBefore(text: string, index: number): number {
  return Math.max(...CONNECTORS.map((c) => text.lastIndexOf(c, index)));
}

function firstConnectorAfter(text: string, index: number): number {
  const found = CONNECTORS.map((c) => text.indexOf(c, index)).filter((i) => i >= 0);
  return found.length > 0 ? Math.min(...found) : -1;
}

/**
 * Tira da frase o trecho com a variavel sem valor: do conector (", " ou " e ")
 * antes dela ate o proximo conector (ou o fim da frase). Sem conector antes, a
 * frase inteira sai (`null`).
 */
function dropMissingClauses(sentence: string): string | null {
  const ending = sentence.match(SENTENCE_END_RE)?.[0] ?? "";
  let text = sentence.slice(0, sentence.length - ending.length);
  while (text.includes(MISSING)) {
    const at = text.indexOf(MISSING);
    const from = lastConnectorBefore(text, at);
    if (from <= 0) return null;
    const to = firstConnectorAfter(text, at);
    text = to === -1 ? text.slice(0, from) : `${text.slice(0, from)}${text.slice(to)}`;
  }
  return text.trim() ? `${text.trim()}${ending}` : null;
}

/**
 * Troca as variaveis do texto pelos valores (mesma ideia do `fillMessage` das
 * mensagens). Trecho com variavel sem valor sai: primeiro so a parte da frase
 * (entre virgulas ou depois de " e "), senao a frase inteira. Curso de um dia
 * (`sameDay`): "de {inicio} a {fim}" vira "em {inicio}". Variavel desconhecida
 * conta como sem valor (o servico recusa ao salvar).
 */
export function fillCertificateText(
  text: string,
  values: CertificateValues,
  options: { sameDay?: boolean } = {},
): string {
  const sameDayText = options.sameDay
    ? text.replace(/(^|\s)([Dd])e \{inicio\} a \{fim\}/g, (_m, space: string, d: string) =>
        `${space}${d === "D" ? "E" : "e"}m {inicio}`,
      )
    : text;
  // Nome que ja diz "curso" ("Yoga Flow curso"): "o curso {curso}" nao repete a palavra.
  const source = /(^|\s)curso(\s|$)/i.test(values.curso ?? "")
    ? sameDayText.replace(/\b[Cc]urso\s+\{curso\}/g, "{curso}")
    : sameDayText;
  const filled = source.replace(VARIABLE_RE, (_match, key: string) => {
    const value = values[key as CertificateVariableName];
    return value === undefined || value === "" ? MISSING : value;
  });
  return filled
    .split("\n")
    .flatMap((line) => {
      if (!line.includes(MISSING)) return [line.trim()];
      const kept = line
        .trim()
        .split(/(?<=[.!?…])\s+/)
        .map((sentence) => (sentence.includes(MISSING) ? dropMissingClauses(sentence) : sentence))
        .filter((sentence): sentence is string => Boolean(sentence))
        .join(" ");
      return kept ? [kept] : [];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface CertificateText {
  title: string;
  body: string;
  /** "São Paulo, 14 de outubro de 2026" (sem cidade, so a data). */
  placeAndDate: string;
}

export interface RenderedCertificate extends CertificateText {
  signatures: CertificateSignature[];
}

/** Texto final do certificado com o modelo do espaco (titulo, corpo, local e data, assinaturas). */
export function renderCertificate(
  cert: AnyCertificate,
  template: Pick<CertificateTemplate, "title" | "body" | "signatures" | "showAttendance">,
): RenderedCertificate {
  const graduation = isGraduationCertificate(cert);
  const values = graduation
    ? graduationCertificateVariableValues(cert)
    : certificateVariableValues(cert, { showAttendance: template.showAttendance });
  const options = { sameDay: !graduation && cert.startDate === cert.endDate };
  const date = values.data ?? "";
  return {
    title: fillCertificateText(template.title, values, options),
    body: fillCertificateText(template.body, values, options),
    placeAndDate: values.cidade ? `${values.cidade}, ${date}` : date,
    signatures: template.signatures.map((s) => ({
      name: fillCertificateText(s.name, values, options),
      role: s.role.trim(),
    })),
  };
}

/**
 * Codigo de verificacao do certificado emitido (doc 21 §1.3): "GH-7K3M-2A9F".
 * Sem 0, O, 1 e I, para ler em voz alta sem confundir; 8 caracteres de 32 dao
 * mais de um trilhao de combinacoes.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CERTIFICATE_CODE_RE = /^GH-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export function newCertificateCode(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `GH-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** O codigo como a pessoa digita (minusculas, sem tracos ou espacos) vira o guardado. */
export function normalizeCertificateCode(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/[\s-]/g, "").replace(/^GH/, "");
  if (raw.length !== 8) return null;
  const code = `GH-${raw.slice(0, 4)}-${raw.slice(4)}`;
  return CERTIFICATE_CODE_RE.test(code) ? code : null;
}

/** Texto do modelo padrao. */
export function defaultCertificateText(cert: CourseCertificate): CertificateText {
  const { title, body, placeAndDate } = renderCertificate(cert, defaultCertificateTemplate());
  return { title, body, placeAndDate };
}

export interface CertificateTemplateIssue {
  field: string;
  message: string;
}

function variableIssue(field: string, text: string, kind: CertificateKind): CertificateTemplateIssue | null {
  const unknown = unknownCertificateVariables(text, kind);
  if (unknown.length === 0) return null;
  const names = unknown.map((v) => `{${v}}`).join(", ");
  const list = certificateVariablesFor(kind).map((v) => `{${v}}`).join(", ");
  return {
    field,
    message: `${unknown.length === 1 ? "Variável desconhecida" : "Variáveis desconhecidas"}: ${names}. Use: ${list}.`,
  };
}

/** Regras do modelo (o servico recusa com VALIDATION). Lista vazia = ok. */
export function validateCertificateTemplate(
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body" | "signatures"> & {
    artwork?: Partial<CertificateArtwork>;
  },
  /** Tipo do modelo: decide as variaveis aceitas. */
  kind: CertificateKind = "course",
): CertificateTemplateIssue[] {
  const issues: CertificateTemplateIssue[] = [];
  const push = (issue: CertificateTemplateIssue | null) => {
    if (issue) issues.push(issue);
  };
  if (!(CERTIFICATE_LAYOUTS as readonly string[]).includes(template.layout)) {
    push({ field: "layout", message: "Escolha um layout." });
  }
  // "Minha arte": precisa da imagem e de ajustes conhecidos.
  if (template.layout === "custom") {
    const art = template.artwork;
    if (!art?.fileId?.trim()) push({ field: "artwork", message: "Envie a arte de fundo." });
    else {
      if (!(CERTIFICATE_TEXT_POSITIONS as readonly string[]).includes(String(art.textPosition))) {
        push({ field: "artwork.textPosition", message: "Escolha onde o texto fica." });
      }
      if (!(CERTIFICATE_INKS as readonly string[]).includes(String(art.ink))) {
        push({ field: "artwork.ink", message: "Escolha a cor do texto." });
      }
      const hidden = art.hidden ?? [];
      if (!Array.isArray(hidden) || hidden.some((part) => !(CERTIFICATE_PARTS as readonly string[]).includes(part))) {
        push({ field: "artwork.hidden", message: "Parte desconhecida." });
      } else if (hidden.includes("title") && hidden.includes("body")) {
        push({ field: "artwork.hidden", message: "Mostre pelo menos o título ou o texto." });
      }
      for (const block of CERTIFICATE_BLOCKS) {
        const pos = art[block];
        if (pos !== undefined && !isSheetPosition(pos)) {
          push({ field: `artwork.${block}`, message: "Posição fora da folha." });
        }
      }
      if (art.logoSize !== undefined && !(CERTIFICATE_LOGO_SIZES as readonly string[]).includes(String(art.logoSize))) {
        push({ field: "artwork.logoSize", message: "Escolha o tamanho da logo." });
      }
      if (art.qrSize !== undefined && !(CERTIFICATE_QR_SIZES as readonly string[]).includes(String(art.qrSize))) {
        push({ field: "artwork.qrSize", message: "Escolha o tamanho do QR Code." });
      }
    }
  }
  if (!(CERTIFICATE_ACCENT_COLORS as readonly string[]).includes(template.accentColor)) {
    push({ field: "accentColor", message: "Escolha uma cor." });
  }
  const title = template.title.trim();
  if (!title) push({ field: "title", message: "Informe o título." });
  else if (title.length > CERTIFICATE_LIMITS.title) {
    push({ field: "title", message: `O título tem no máximo ${CERTIFICATE_LIMITS.title} caracteres.` });
  } else push(variableIssue("title", title, kind));
  const body = template.body.trim();
  if (!body) push({ field: "body", message: "Escreva o texto do certificado." });
  else if (body.length > CERTIFICATE_LIMITS.body) {
    push({ field: "body", message: `O texto tem no máximo ${CERTIFICATE_LIMITS.body} caracteres.` });
  } else push(variableIssue("body", body, kind));
  const signatures = template.signatures;
  if (signatures.length < 1 || signatures.length > CERTIFICATE_LIMITS.maxSignatures) {
    push({ field: "signatures", message: "Use 1 ou 2 assinaturas." });
  }
  signatures.slice(0, CERTIFICATE_LIMITS.maxSignatures).forEach((s, i) => {
    const name = s.name.trim();
    if (!name) push({ field: `signatures.${i}.name`, message: "Informe o nome." });
    else if (name.length > CERTIFICATE_LIMITS.signatureText) {
      push({ field: `signatures.${i}.name`, message: `Máximo de ${CERTIFICATE_LIMITS.signatureText} caracteres.` });
    } else push(variableIssue(`signatures.${i}.name`, name, kind));
    if (s.role.trim().length > CERTIFICATE_LIMITS.signatureText) {
      push({ field: `signatures.${i}.role`, message: `Máximo de ${CERTIFICATE_LIMITS.signatureText} caracteres.` });
    }
  });
  return issues;
}
