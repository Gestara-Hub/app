import type {
  CertificateAccentColor,
  CertificateLayout,
  CourseCertificate,
  DateISO,
} from "@gestarahub/contracts";
import type { CertificateVariable } from "@gestarahub/core/certificate";

/** Cores da paleta (tons escuros: legiveis no papel branco e na impressao). */
export const ACCENT_COLORS: Record<CertificateAccentColor, { label: string; hex: string }> = {
  graphite: { label: "Grafite", hex: "#3f3f46" },
  navy: { label: "Azul-marinho", hex: "#1e3a8a" },
  green: { label: "Verde", hex: "#166534" },
  wine: { label: "Vinho", hex: "#881337" },
  gold: { label: "Dourado", hex: "#a16207" },
  purple: { label: "Roxo", hex: "#5b21b6" },
};

export const LAYOUT_OPTIONS: { value: CertificateLayout; label: string; description: string }[] = [
  { value: "classic", label: "Clássico", description: "Moldura e título com serifa" },
  { value: "modern", label: "Moderno", description: "Faixa lateral colorida" },
  { value: "minimal", label: "Limpo", description: "Só texto e linhas finas" },
];

/** Nome amigavel de cada variavel nos chips do editor. */
export const VARIABLE_LABELS: Record<CertificateVariable, string> = {
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
};

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
    ...(city?.trim() ? { city: city.trim() } : {}),
    issuedOn: today,
  };
}
