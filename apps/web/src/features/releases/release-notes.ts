/**
 * Novidades do GestaraHub para quem usa (doc technical/27). Uma entrada por
 * versao, a mais nova primeiro. Texto curto, sem termo tecnico, 3 a 6 itens.
 * O agente redige a partir das mudancas da versao e o dono aprova antes do
 * deploy; `pnpm release:prepare` avisa se a versao nova ainda nao tem entrada.
 */
export interface ReleaseNoteItem {
  text: string;
}

export interface ReleaseNote {
  /** Mesma versao do `package.json` (ex.: "2026.11.10"). */
  version: string;
  /** Dia da versao, "yyyy-MM-dd". */
  date: string;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "2026.11.17",
    date: "2026-11-17",
    items: [
      { text: "Novidades mostram o número de cada versão." },
      { text: "Base pronta para o envio automático pelo WhatsApp do seu espaço." },
    ],
  },
  {
    version: "2026.11.16-2",
    date: "2026-11-16",
    items: [
      { text: "Barra no topo mostra quando uma tela ou painel está carregando." },
      { text: "Formulários indicam o salvamento e evitam fechar por engano no meio." },
      { text: "Horários cabem melhor no celular e salvamentos simultâneos estão mais estáveis." },
    ],
  },
  {
    version: "2026.11.16",
    date: "2026-11-16",
    items: [
      { text: "Inscrição pública em eventos por link, com ingresso e QR code." },
      { text: "Evento de graduação, graduação em grupo e mudança de turma." },
      { text: "Chamada com botão Salvar e rascunho guardado no aparelho." },
      { text: "Selo Em atraso e filtro Visitante na lista de alunos." },
      { text: "Cores das modalidades no calendário e tela própria de Certificados." },
      { text: "Resumo financeiro mais claro, com filtro direto pelos cards." },
    ],
  },
  {
    version: "2026.11.10",
    date: "2026-11-10",
    items: [
      { text: "Eventos e seminários com inscrição, chamada e certificado." },
      { text: "Mais de um instrutor por evento, escolhido por dia." },
      { text: "Escolha o som da chamada em Preferências." },
      { text: "Menu ⋮ das listas mais curto, com Acompanhamento." },
      { text: "Formulários de turma e evento organizados em partes." },
      { text: "Ao salvar, o cursor vai para o campo que falta." },
    ],
  },
];

/** Versao mais nova com novidades (o ponto no menu compara com esta). */
export const LATEST_RELEASE_VERSION: string | undefined = RELEASE_NOTES[0]?.version;
