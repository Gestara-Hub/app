import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  CertificateAccentColor,
  CertificateArtwork,
  CertificateInk,
  CertificateLayout,
  CertificatePart,
  CertificateSignature,
  CertificateTemplate,
  CertificateTextPosition,
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
 * Modelo padrao (o espaco que nunca salvou o proprio). `teacherTitle` e a
 * palavra do espaco para quem da aula ("Instrutor" ou "Professor").
 */
export function defaultCertificateTemplate(teacherTitle = "Instrutor"): CertificateTemplate {
  return {
    layout: "classic",
    accentColor: "graphite",
    title: DEFAULT_CERTIFICATE_TITLE,
    body: DEFAULT_CERTIFICATE_BODY,
    signatures: DEFAULT_CERTIFICATE_SIGNATURES.map((s) => ({
      ...s,
      role: s.name === "{professor}" ? teacherTitle : s.role,
    })),
    showAttendance: true,
  };
}

const VARIABLE_RE = /\{(\w+)\}/g;
const KNOWN = new Set<string>(CERTIFICATE_VARIABLES);

/** Variaveis do texto que nao existem (sem repetir, na ordem em que aparecem). */
export function unknownCertificateVariables(text: string): string[] {
  const unknown: string[] = [];
  for (const [, key] of text.matchAll(VARIABLE_RE)) {
    if (!KNOWN.has(key) && !unknown.includes(key)) unknown.push(key);
  }
  return unknown;
}

export type CertificateValues = Partial<Record<CertificateVariable, string>>;

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
    const value = KNOWN.has(key) ? values[key as CertificateVariable] : undefined;
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
  cert: CourseCertificate,
  template: Pick<CertificateTemplate, "title" | "body" | "signatures" | "showAttendance">,
): RenderedCertificate {
  const values = certificateVariableValues(cert, { showAttendance: template.showAttendance });
  const options = { sameDay: cert.startDate === cert.endDate };
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

const VARIABLE_LIST = CERTIFICATE_VARIABLES.map((v) => `{${v}}`).join(", ");

function variableIssue(field: string, text: string): CertificateTemplateIssue | null {
  const unknown = unknownCertificateVariables(text);
  if (unknown.length === 0) return null;
  const names = unknown.map((v) => `{${v}}`).join(", ");
  return {
    field,
    message: `${unknown.length === 1 ? "Variável desconhecida" : "Variáveis desconhecidas"}: ${names}. Use: ${VARIABLE_LIST}.`,
  };
}

/** Regras do modelo (o servico recusa com VALIDATION). Lista vazia = ok. */
export function validateCertificateTemplate(
  template: Pick<CertificateTemplate, "layout" | "accentColor" | "title" | "body" | "signatures"> & {
    artwork?: Partial<CertificateArtwork>;
  },
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
    }
  }
  if (!(CERTIFICATE_ACCENT_COLORS as readonly string[]).includes(template.accentColor)) {
    push({ field: "accentColor", message: "Escolha uma cor." });
  }
  const title = template.title.trim();
  if (!title) push({ field: "title", message: "Informe o título." });
  else if (title.length > CERTIFICATE_LIMITS.title) {
    push({ field: "title", message: `O título tem no máximo ${CERTIFICATE_LIMITS.title} caracteres.` });
  } else push(variableIssue("title", title));
  const body = template.body.trim();
  if (!body) push({ field: "body", message: "Escreva o texto do certificado." });
  else if (body.length > CERTIFICATE_LIMITS.body) {
    push({ field: "body", message: `O texto tem no máximo ${CERTIFICATE_LIMITS.body} caracteres.` });
  } else push(variableIssue("body", body));
  const signatures = template.signatures;
  if (signatures.length < 1 || signatures.length > CERTIFICATE_LIMITS.maxSignatures) {
    push({ field: "signatures", message: "Use 1 ou 2 assinaturas." });
  }
  signatures.slice(0, CERTIFICATE_LIMITS.maxSignatures).forEach((s, i) => {
    const name = s.name.trim();
    if (!name) push({ field: `signatures.${i}.name`, message: "Informe o nome." });
    else if (name.length > CERTIFICATE_LIMITS.signatureText) {
      push({ field: `signatures.${i}.name`, message: `Máximo de ${CERTIFICATE_LIMITS.signatureText} caracteres.` });
    } else push(variableIssue(`signatures.${i}.name`, name));
    if (s.role.trim().length > CERTIFICATE_LIMITS.signatureText) {
      push({ field: `signatures.${i}.role`, message: `Máximo de ${CERTIFICATE_LIMITS.signatureText} caracteres.` });
    }
  });
  return issues;
}
