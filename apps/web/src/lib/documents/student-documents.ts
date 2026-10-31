import type { DocumentBlock, DocumentModel, DocumentTone } from "@gestarahub/contracts";
import { documentDate, documentDateTime } from "./format";

/**
 * Documentos do aluno no layout unico: termo de autorizacao do responsavel
 * (aluno menor, LGPD art. 14) e boletim com notas e trilha. Funcoes puras.
 */

export interface MinorConsentInput {
  organizationName: string;
  organizationDetails?: string;
  studentName: string;
  birthDate?: string;
  guardian?: { name: string; relationship?: string; phone?: string };
  /** Ja autorizado: como, quando e por quem. */
  confirmed?: { method: "online" | "paper"; at?: string; by?: string };
  issuedAt: string;
  fileKey: string;
}

/** As mesmas declaracoes da pagina que o responsavel abre pelo link. */
export function minorConsentClauses(studentName: string, organizationName: string): string[] {
  return [
    `1. Matrícula e atividades: autorizo a matrícula e a participação de ${studentName} nas aulas, treinos, turmas e atividades promovidas por ${organizationName}.`,
    "2. Tratamento de dados (art. 14 da LGPD): autorizo a coleta e o tratamento dos dados cadastrais (nome, nascimento, controle de frequência e pagamentos) apenas para a gestão pedagógica e operacional do espaço, sem venda ou repasse a terceiros.",
    "3. Avisos: concordo em receber lembretes de aulas, avisos e cobranças no telefone informado.",
  ];
}

export function minorConsentDocument(input: MinorConsentInput): DocumentModel {
  const status = input.confirmed
    ? input.confirmed.method === "online"
      ? `Autorizado pelo link em ${input.confirmed.at ? documentDateTime(input.confirmed.at) : "data não registrada"}${input.confirmed.by ? `, por ${input.confirmed.by}` : ""}. O registro guarda data, hora, IP e navegador.`
      : `Termo impresso assinado e arquivado${input.confirmed.at ? ` em ${documentDate(input.confirmed.at)}` : ""}.`
    : "Aguardando a assinatura do responsável.";
  return {
    fileName: `termo-responsavel-${input.fileKey}`,
    title: "Termo de autorização do responsável",
    subtitle: "Matrícula e dados de aluno menor de idade (art. 14 da LGPD).",
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [{ label: "Emitido em", value: documentDateTime(input.issuedAt) }],
    blocks: [
      {
        type: "fields",
        title: "Aluno",
        items: [
          { label: "Nome", value: input.studentName },
          { label: "Nascimento", value: input.birthDate, format: "date" },
        ],
      },
      {
        type: "fields",
        title: "Responsável legal",
        items: [
          { label: "Nome", value: input.guardian?.name },
          { label: "Parentesco", value: input.guardian?.relationship },
          { label: "Telefone", value: input.guardian?.phone, format: "phone" },
        ],
      },
      ...minorConsentClauses(input.studentName, input.organizationName).map(
        (text, index): DocumentBlock => ({ type: "text", title: index === 0 ? "Declarações" : undefined, text }),
      ),
      { type: "text", title: "Situação", text: status, tone: input.confirmed ? "default" : "muted" },
      { type: "signatures", lines: ["Responsável legal", input.organizationName] },
    ],
  };
}

export interface ReportCardGradeRow {
  date: string;
  name: string;
  className: string;
  levelName?: string;
  /** Peso na media ("1", "1,5") ou, na soma dos pontos, quanto vale ("2,5"). Vazio na recuperacao. */
  weight?: string;
  /** Nota pronta para mostrar ("7,5", "B", "Apto", "Faltou"). */
  grade?: string;
  tone?: DocumentTone;
}

export interface ReportCardModalityInput {
  modalityName: string;
  /** "Média geral 7,8 · Aprovação a partir de 6,0". */
  summary: string;
  /** Rotulo da coluna do peso: "Peso" ou, na soma dos pontos, "Vale". */
  weightLabel?: string;
  rows: ReportCardGradeRow[];
}

export interface ReportCardPromotionRow {
  date: string;
  modalityName: string;
  from?: string;
  to: string;
  by?: string;
}

export interface ReportCardInput {
  organizationName: string;
  organizationDetails?: string;
  studentName: string;
  /** "Faixa atual: Azul · 2º grau" por modalidade. */
  currentLevels: { modalityName: string; label: string; since: string }[];
  modalities: ReportCardModalityInput[];
  promotions: ReportCardPromotionRow[];
  /** Palavras da area: "Faixa", "Graduação". */
  levelLabel: string;
  promotionLabel: string;
  issuedAt: string;
  fileKey: string;
}

/** Boletim do aluno: trilha atual, notas por modalidade e historico de avancos. */
export function reportCardDocument(input: ReportCardInput): DocumentModel {
  const blocks: DocumentBlock[] = [];
  if (input.currentLevels.length > 0) {
    blocks.push({
      type: "table",
      title: "Trilha",
      columns: [
        { key: "modality", label: "Modalidade", width: 1.6 },
        { key: "level", label: input.levelLabel, width: 1.6 },
        { key: "since", label: "Desde", format: "date" },
      ],
      rows: input.currentLevels.map((l) => ({ cells: { modality: l.modalityName, level: l.label, since: l.since } })),
      emptyText: "Sem trilha.",
    });
  }
  for (const modality of input.modalities) {
    blocks.push({
      type: "table",
      title: `Notas · ${modality.modalityName}`,
      columns: [
        { key: "date", label: "Data", format: "date", width: 0.9 },
        { key: "name", label: "Avaliação", width: 1.9 },
        { key: "className", label: "Turma", width: 1.5 },
        { key: "level", label: input.levelLabel, width: 1.1 },
        { key: "weight", label: modality.weightLabel ?? "Peso", width: 0.6 },
        { key: "grade", label: "Nota", align: "right", width: 0.8 },
      ],
      rows: modality.rows.map((r) => ({
        cells: { date: r.date, name: r.name, className: r.className, level: r.levelName, weight: r.weight, grade: r.grade },
        tones: { grade: r.tone ?? "default" },
      })),
      emptyText: "Nenhuma avaliação ainda.",
    });
    blocks.push({ type: "text", text: modality.summary, tone: "muted" });
  }
  if (input.promotions.length > 0) {
    blocks.push({
      type: "table",
      title: `Histórico de ${input.promotionLabel.toLowerCase()}`,
      columns: [
        { key: "date", label: "Data", format: "date", width: 0.9 },
        { key: "modality", label: "Modalidade", width: 1.4 },
        { key: "from", label: "De", width: 1.3 },
        { key: "to", label: "Para", width: 1.3 },
        { key: "by", label: "Por", width: 1.3 },
      ],
      rows: input.promotions.map((p) => ({
        cells: { date: p.date, modality: p.modalityName, from: p.from, to: p.to, by: p.by },
      })),
      emptyText: "Sem histórico.",
    });
  }
  if (blocks.length === 0) {
    blocks.push({ type: "text", text: "Ainda não há notas nem trilha registradas para este aluno.", tone: "muted" });
  }
  blocks.push({ type: "signatures", lines: [input.organizationName] });
  return {
    fileName: `boletim-${input.fileKey}`,
    title: "Boletim do aluno",
    subtitle: input.studentName,
    header: { organizationName: input.organizationName, details: input.organizationDetails },
    meta: [{ label: "Emitido em", value: documentDateTime(input.issuedAt) }],
    blocks,
  };
}
