/**
 * Dados publicos do site (landing, paginas legais e metadados). A URL vem do
 * ambiente em producao; sem ela, o dev local. O e-mail de contato ainda nao foi
 * definido: vazio, as paginas e o rodape escondem a linha de contato.
 */
export const SITE_NAME = "GestaraHub";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_TAGLINE = "Gestão simples para quem ensina";
export const SITE_DESCRIPTION =
  "Turmas, chamada no celular, mensalidades e evolução dos alunos em um só lugar. Para quem dá aula em grupo ou particular: lutas, pilates, dança, música, idiomas, confeitaria, artesanato e cursos livres. Plano grátis, sem cartão de crédito.";
export const SUPPORT_EMAIL = "";

/** Data da versao atual dos Termos de uso e da Politica de privacidade. */
export const LEGAL_UPDATED_AT = "17/10/2026";
