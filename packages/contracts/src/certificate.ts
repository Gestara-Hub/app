import type { DateTimeISO, Id } from "./common";
import type { CourseCertificate } from "./class";

/**
 * Modelo de certificado do espaco (doc 21, secao 1; recurso pago
 * `certificates`). Um por organizacao na v1; ausente = modelo padrao. So
 * desenho e texto: os dados de cada aluno vem de `CourseCertificate`.
 */

/** Desenho da folha: classico (moldura), moderno (faixa lateral) ou limpo. */
export type CertificateLayout = "classic" | "modern" | "minimal";

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
  /** Sem frequencia, a variavel {frequencia} fica sem valor. */
  showAttendance: boolean;
  /** Ausente = modelo padrao, nunca salvo. */
  updatedAt?: DateTimeISO;
}

/** Salvar troca o modelo inteiro (sem `logoFileId` = sem logo). */
export type SaveCertificateTemplate = Omit<CertificateTemplate, "updatedAt">;

/** O que a tela do certificado recebe: os dados do aluno e o modelo do espaco. */
export interface CourseCertificateDocument {
  certificate: CourseCertificate;
  template: CertificateTemplate;
}
