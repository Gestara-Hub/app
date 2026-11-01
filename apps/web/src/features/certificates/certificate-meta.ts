import type {
  CertificateAccentColor,
  CertificateInk,
  CertificateKind,
  CertificateLayout,
  CertificatePart,
  CertificateTextPosition,
  CourseCertificate,
  DateISO,
  GraduationCertificate,
} from "@gestarahub/contracts";
import { CERTIFICATE_ACCENT_HEX, type CertificateVariableName } from "@gestarahub/core/certificate";

/** Cores da paleta (tons escuros: legiveis no papel branco e na impressao). */
export const ACCENT_COLORS: Record<CertificateAccentColor, { label: string; hex: string }> = {
  graphite: { label: "Grafite", hex: CERTIFICATE_ACCENT_HEX.graphite },
  navy: { label: "Azul-marinho", hex: CERTIFICATE_ACCENT_HEX.navy },
  green: { label: "Verde", hex: CERTIFICATE_ACCENT_HEX.green },
  wine: { label: "Vinho", hex: CERTIFICATE_ACCENT_HEX.wine },
  gold: { label: "Dourado", hex: CERTIFICATE_ACCENT_HEX.gold },
  purple: { label: "Roxo", hex: CERTIFICATE_ACCENT_HEX.purple },
};

export const LAYOUT_OPTIONS: { value: CertificateLayout; label: string; description: string }[] = [
  { value: "classic", label: "Clássico", description: "Moldura e título com serifa" },
  { value: "modern", label: "Moderno", description: "Faixa lateral colorida" },
  { value: "minimal", label: "Limpo", description: "Só texto e linhas finas" },
  { value: "custom", label: "Minha arte", description: "Sua imagem de fundo" },
];

export const TEXT_POSITION_OPTIONS: { value: CertificateTextPosition; label: string }[] = [
  { value: "top", label: "Em cima" },
  { value: "center", label: "No centro" },
  { value: "bottom", label: "Embaixo" },
];

export const INK_OPTIONS: { value: CertificateInk; label: string; description: string }[] = [
  { value: "dark", label: "Escuro", description: "Arte clara" },
  { value: "light", label: "Claro", description: "Arte escura" },
];

/** Partes que a arte pode ja trazer impressas, na ordem da folha. */
export const PART_LABELS: Record<CertificatePart, string> = {
  logo: "Logo",
  organizationName: "Nome do espaço",
  title: "Título",
  body: "Texto",
  date: "Local e data",
  signatures: "Assinaturas",
};

/** Nome amigavel de cada variavel nos chips do editor (curso e graduacao). */
export const VARIABLE_LABELS: Record<CertificateVariableName, string> = {
  aluno: "Aluno",
  curso: "Curso",
  inicio: "Início",
  fim: "Fim",
  aulas: "Aulas",
  carga_horaria: "Carga horária",
  frequencia: "Frequência",
  professor: "Professor",
  empresa: "Nome do espaço",
  cidade: "Cidade",
  data: "Data de emissão",
  modalidade: "Modalidade",
  etapa: "Etapa alcançada",
  etapa_anterior: "Etapa anterior",
  grau: "Grau",
};

/** No certificado de graduacao, "{data}" e o dia da graduacao. */
export function variableLabel(variable: CertificateVariableName, kind: CertificateKind): string {
  return kind === "graduation" && variable === "data" ? "Data da graduação" : VARIABLE_LABELS[variable];
}

/** Os dois tipos de certificado, na ordem da escolha no editor. */
export const CERTIFICATE_KIND_OPTIONS: { value: CertificateKind; label: string; description: string }[] = [
  { value: "course", label: "Conclusão de curso", description: "Turma com início e fim." },
  { value: "graduation", label: "Graduação", description: "Faixa, nível, módulo ou fase." },
];

/** Dados de exemplo da previa do editor de graduacao. */
export function sampleGraduationCertificate({
  organizationName,
  city,
  today,
}: {
  organizationName?: string;
  city?: string;
  today: DateISO;
}): GraduationCertificate {
  return {
    promotionId: "sample",
    studentId: "sample",
    modalityId: "sample",
    organizationName: organizationName?.trim() || "Seu espaço",
    studentName: "Ana Souza",
    modalityName: "Jiu-Jitsu",
    levelName: "Faixa Azul",
    previousLevelName: "Faixa Branca",
    graduatedOn: "2026-09-12",
    instructorName: "Carla Mendes",
    verificationCode: "GH-7K3M-2A9F",
    ...(city?.trim() ? { city: city.trim() } : {}),
    issuedOn: today,
  };
}

/** Dados de exemplo da previa do editor. */
export function sampleCertificate({
  organizationName,
  city,
  today,
}: {
  organizationName?: string;
  city?: string;
  today: DateISO;
}): CourseCertificate {
  return {
    enrollmentId: "sample",
    classGroupId: "sample",
    organizationName: organizationName?.trim() || "Seu espaço",
    studentName: "Ana Souza",
    courseName: "Confeitaria Básica",
    startDate: "2026-08-04",
    endDate: "2026-09-22",
    lessonsCount: 8,
    workloadMinutes: 16 * 60,
    attendancePercent: 92,
    instructorName: "Carla Mendes",
    // A previa mostra o rodape de verificacao com um codigo de exemplo.
    verificationCode: "GH-7K3M-2A9F",
    ...(city?.trim() ? { city: city.trim() } : {}),
    issuedOn: today,
  };
}
