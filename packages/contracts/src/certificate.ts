import type { DateTimeISO, Id } from "./common";
import type { CourseCertificate } from "./class";

/**
 * Modelo de certificado do espaco (doc 21, secao 1; recurso pago
 * `certificates`). Um por organizacao na v1; ausente = modelo padrao. So
 * desenho e texto: os dados de cada aluno vem de `CourseCertificate`.
 */

/**
 * Desenho da folha: classico (moldura), moderno (faixa lateral), limpo ou a
 * arte do proprio espaco como fundo ("Minha arte", doc 21 §1.1).
 */
export type CertificateLayout = "classic" | "modern" | "minimal" | "custom";

/** Onde o bloco de texto fica sobre a arte. */
export type CertificateTextPosition = "top" | "center" | "bottom";
/** Cor do texto sobre a arte: escura (arte clara) ou clara (arte escura). */
export type CertificateInk = "dark" | "light";
/** Partes do certificado que a arte pode ja trazer impressas (e que entao saem). */
export type CertificatePart = "logo" | "organizationName" | "title" | "body" | "date" | "signatures";

/** Arte propria como fundo (layout "custom"): imagem A4 deitado no armazenamento de arquivos. */
export interface CertificateArtwork {
  fileId: Id;
  textPosition: CertificateTextPosition;
  ink: CertificateInk;
  /** Partes que nao aparecem sobre a arte. */
  hidden: CertificatePart[];
  /**
   * Blocos arrastados na previa (31/10/2026), em % da folha (canto superior
   * esquerdo do bloco; x da largura, y da altura). Ausente = lugar padrao: o QR
   * no canto inferior direito, os outros no fluxo do texto.
   */
  verification?: SheetPosition;
  logo?: SheetPosition;
  text?: SheetPosition;
  signatures?: SheetPosition;
  /** Tamanho da logo sobre a arte; ausente = media. */
  logoSize?: CertificateLogoSize;
  /** Tamanho do QR sobre a arte; ausente = normal. */
  qrSize?: CertificateQrSize;
}

export interface SheetPosition {
  x: number;
  y: number;
}
export type CertificateLogoSize = "small" | "medium" | "large";
export type CertificateQrSize = "small" | "normal";
/** Blocos que a pessoa pode arrastar na arte propria. */
export type CertificateBlock = "logo" | "text" | "signatures" | "verification";

/** Cor de destaque (paleta fechada, legivel na impressao). */
export type CertificateAccentColor = "graphite" | "navy" | "green" | "wine" | "gold" | "purple";

/** Linha de assinatura. `name` aceita variaveis ({professor}, {empresa}). */
export interface CertificateSignature {
  name: string;
  role: string;
}

export interface CertificateTemplate {
  layout: CertificateLayout;
  accentColor: CertificateAccentColor;
  /** Aceita variaveis. */
  title: string;
  /** Texto com variaveis ({aluno}, {curso}...). */
  body: string;
  /** 1 ou 2 linhas de assinatura. */
  signatures: CertificateSignature[];
  /** Logo (imagem) no armazenamento de arquivos. */
  logoFileId?: Id;
  /** Arte de fundo e seus ajustes; obrigatoria no layout "custom", ignorada nos outros. */
  artwork?: CertificateArtwork;
  /** Sem frequencia, a variavel {frequencia} fica sem valor. */
  showAttendance: boolean;
  /** Ausente = modelo padrao, nunca salvo. */
  updatedAt?: DateTimeISO;
}

/** Aluno concluido, para a previa do editor de modelos ("Previa com"). */
export interface CompletedEnrollmentOption {
  enrollmentId: Id;
  studentName: string;
  courseName: string;
}

/** Emissao em lote da turma (doc 21 §1.4): os certificados dos alunos e o modelo que vale para eles. */
export interface CourseCertificatesBatch {
  classGroupId: Id;
  className: string;
  template: CertificateTemplate;
  items: Omit<CourseCertificateDocument, "template">[];
}

/** Salvar troca o modelo inteiro (sem `logoFileId` = sem logo; sem `artwork` = sem arte). */
export type SaveCertificateTemplate = Omit<CertificateTemplate, "updatedAt">;

/** O que a tela do certificado recebe: os dados do aluno, o modelo e a emissao. */
export interface CourseCertificateDocument {
  certificate: CourseCertificate;
  /** Registro da emissao (doc 21 §1.3). */
  issued: {
    code: string;
    status: "valid" | "canceled";
    issuedAt: DateTimeISO;
    canceledAt?: DateTimeISO;
  };
  template: CertificateTemplate;
}
