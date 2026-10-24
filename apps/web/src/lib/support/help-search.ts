import kbJson from "./help-kb.generated.json";

/**
 * Busca na central de ajuda (docs/ajuda), pelo texto da pergunta: pontuacao tipo
 * BM25 sobre os trechos, sem servico externo. Pura: o assistente e a tela usam a
 * mesma busca. O indice sai de `pnpm help:build`.
 */
export interface HelpChunk {
  id: string;
  article: string;
  title: string;
  route?: string;
  text: string;
}

const STOPWORDS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sobre e ou que se eu meu minha meus minhas voce seu sua como qual quais quando onde ao aos ate ja mais muito pode posso preciso quero fazer faco ser ter esta estao foi sao ha mas nao sim tambem so isso essa esse aqui la".split(
    " ",
  ),
);

export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Palavras da busca: sem acento, sem palavras de ligacao e com plural simples reduzido. */
export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word));
}

/** Fracao das palavras da pergunta que o trecho precisa ter. */
const MIN_MATCH_RATIO = 0.5;
const K1 = 1.4;
const B = 0.75;

export interface HelpIndex {
  chunks: HelpChunk[];
  docs: { tf: Map<string, number>; length: number; titleTokens: Set<string> }[];
  df: Map<string, number>;
  avgLength: number;
}

export function buildIndex(chunks: HelpChunk[]): HelpIndex {
  const df = new Map<string, number>();
  const docs = chunks.map((chunk) => {
    const words = tokens(`${chunk.article} ${chunk.title} ${chunk.title} ${chunk.text}`);
    const tf = new Map<string, number>();
    for (const word of words) tf.set(word, (tf.get(word) ?? 0) + 1);
    for (const word of tf.keys()) df.set(word, (df.get(word) ?? 0) + 1);
    return { tf, length: words.length, titleTokens: new Set(tokens(`${chunk.article} ${chunk.title}`)) };
  });
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(docs.length, 1);
  return { chunks, docs, df, avgLength };
}

export interface HelpHit extends HelpChunk {
  score: number;
}

/** Os trechos que melhor respondem, do mais para o menos; vazio se nada casa. */
export function searchHelp(query: string, limit = 4, index: HelpIndex = DEFAULT_INDEX): HelpHit[] {
  const words = [...new Set(tokens(query))];
  if (words.length === 0) return [];
  const n = index.docs.length;
  const hits: HelpHit[] = [];
  index.docs.forEach((doc, i) => {
    let score = 0;
    let matched = 0;
    for (const word of words) {
      const f = doc.tf.get(word);
      if (!f) continue;
      matched += 1;
      const idf = Math.log(1 + (n - (index.df.get(word) ?? 0) + 0.5) / ((index.df.get(word) ?? 0) + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / index.avgLength)));
      if (doc.titleTokens.has(word)) score += idf * 0.6;
    }
    // Uma palavra solta de uma pergunta longa ("amanha" em "previsao do tempo amanha") nao basta.
    if (score > 0 && matched / words.length >= MIN_MATCH_RATIO) hits.push({ ...index.chunks[i], score });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const HELP_CHUNKS = kbJson as HelpChunk[];
const DEFAULT_INDEX = buildIndex(HELP_CHUNKS);
