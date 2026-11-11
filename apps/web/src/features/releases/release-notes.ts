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
