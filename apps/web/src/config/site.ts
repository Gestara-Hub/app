/**
 * Dados publicos do site (landing, paginas legais e metadados). A URL vem do
 * ambiente em producao; sem ela, o dev local. O e-mail de contato aparece nas
 * paginas legais, no rodape e e o "responda este e-mail" das boas-vindas.
 */
export const SITE_NAME = "GestaraHub";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";
export const SITE_TAGLINE = "Gestão simples para quem ensina";
export const SITE_DESCRIPTION =
  "Turmas, chamada no celular, mensalidades e evolução dos alunos em um só lugar. Para quem dá aula em grupo ou particular: lutas, pilates, dança, música, idiomas, confeitaria, artesanato e cursos livres. Plano grátis, sem cartão de crédito.";
export const SUPPORT_EMAIL = "contato@gestarahub.com.br";

/**
 * Empresa titular do produto (identificacao exigida pelo Decreto 7.962/2013 e
 * pela LGPD; doc product/27). Aparece nos Termos, na Privacidade, no contrato
 * de ativacao, nos rodapes da landing, das paginas publicas e dos e-mails.
 */
export const COMPANY_NAME = "MHMJ Desenvolvimento e Consultoria em Informática Ltda.";
export const COMPANY_CNPJ = "45.160.928/0001-71";
export const COMPANY_ADDRESS = "Rua Bela Cintra, 746, Conjunto 142, Consolação, São Paulo/SP, CEP 01415-902";
/** Foro de eleicao dos Termos: a comarca da sede. */
export const LEGAL_FORUM = "Comarca de São Paulo, Estado de São Paulo";

/** Instagram do produto (novidades); usado no e-mail de boas-vindas. */
export const INSTAGRAM_HANDLE = "gestarahub";
export const INSTAGRAM_URL = "https://www.instagram.com/gestarahub/";

/** Data da versao atual dos Termos de uso e da Politica de privacidade. */
export const LEGAL_UPDATED_AT = "10/11/2026";
