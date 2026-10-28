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
  /** Descrição curta escrita à mão (linha `Resumo:` do artigo); sem ela, vale a primeira frase. */
  summary?: string;
  /** Guia na tela (linha `Guia:` do artigo): destaca, passo a passo, o que a pessoa clica. */
  guide?: HelpGuide;
  text: string;
}

export type GuideStepKind = "botão" | "aba" | "campo" | "menu" | "item" | "texto" | "card";

export interface GuideStep {
  kind: GuideStepKind;
  /** Texto que está na tela (rótulo do botão, da aba ou do campo); `a|b` aceita mais de um. */
  label: string;
  text: string;
}

export interface HelpGuide {
  /** Tela onde o guia começa (a ajuda leva a pessoa até lá). */
  route: string;
  steps: GuideStep[];
}

/** Tira o destino dos links `[texto](/rota)`: a busca indexa só o texto que a pessoa lê. */
const stripLinks = (text: string): string => text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

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
    const words = tokens(`${chunk.article} ${chunk.title} ${chunk.title} ${chunk.summary ?? ""} ${stripLinks(chunk.text)}`);
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

/**
 * Palavras que a pessoa troca uma pela outra. Cada grupo vale como uma só: quem
 * busca "mensalidade" também acha o que está escrito como "plano". Já normalizadas
 * (sem acento) e no singular reduzido de `tokens`.
 */
const SYNONYM_GROUPS: string[][] = [
  ["mensalidade", "plano", "assinatura"],
  ["aluno", "cliente", "estudante"],
  ["professor", "instrutor", "docente"],
  ["pagar", "pagamento", "pago", "paga", "recebimento"],
  ["cobrar", "cobranca"],
  ["whatsapp", "zap", "wpp"],
  ["excluir", "apagar", "remover", "deletar"],
  ["cancelar", "desmatricular", "desmatricula"],
  ["senha", "login", "acesso"],
  ["falta", "ausencia", "ausente"],
  ["aula", "encontro"],
  ["faixa", "nivel", "graduacao"],
];

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) for (const word of group) SYNONYMS.set(word, group.filter((other) => other !== word));

/** Uma letra a mais, a menos, trocada ou duas vizinhas trocadas (erro de digitação comum). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/** Formas que valem pela palavra buscada: ela, os sinônimos e, em palavra longa, termos da ajuda com um erro de digitação. */
function alternatives(word: string, index: HelpIndex): string[] {
  const alts = new Set<string>([word, ...(SYNONYMS.get(word) ?? [])]);
  if (word.length >= 5) {
    for (const term of index.df.keys()) if (term[0] === word[0] && withinOneEdit(word, term)) alts.add(term);
  }
  return [...alts];
}

/** Os trechos que melhor respondem, do mais para o menos; vazio se nada casa. */
export function searchHelp(query: string, limit = 4, index: HelpIndex = DEFAULT_INDEX): HelpHit[] {
  const words = [...new Set(tokens(query))];
  if (words.length === 0) return [];
  const n = index.docs.length;
  const groups = words.map((word) => alternatives(word, index));
  const hits: HelpHit[] = [];
  index.docs.forEach((doc, i) => {
    let score = 0;
    let matched = 0;
    for (const alts of groups) {
      // De cada palavra (com sinônimos e variações) vale a forma que mais pesa neste trecho.
      let best = 0;
      for (const alt of alts) {
        const f = doc.tf.get(alt);
        if (!f) continue;
        const dfAlt = index.df.get(alt) ?? 0;
        const idf = Math.log(1 + (n - dfAlt + 0.5) / (dfAlt + 0.5));
        let part = idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / index.avgLength)));
        if (doc.titleTokens.has(alt)) part += idf * 0.6;
        // O que a pessoa escreveu pesa mais que o sinônimo ou a variação.
        if (alt !== alts[0]) part *= 0.85;
        best = Math.max(best, part);
      }
      if (best > 0) {
        matched += 1;
        score += best;
      }
    }
    // Uma palavra solta de uma pergunta longa ("amanha" em "previsao do tempo amanha") nao basta.
    if (score > 0 && matched / words.length >= MIN_MATCH_RATIO) hits.push({ ...index.chunks[i], score });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Primeira frase do trecho (descrição curta do card); `rest` é o que vem depois, vazio se o trecho é uma frase só. */
export function splitFirstSentence(text: string): { first: string; rest: string } {
  // Lista ("- item" ou "1. passo"): a primeira frase seria só o "1."; o primeiro item é a descrição.
  if (/^(?:\d+[.)]|[-*])\s/.test(text.trim())) {
    const [firstLine, ...others] = text.trim().split("\n");
    return { first: firstLine.replace(/^[-*]\s+/, "").trim(), rest: others.join("\n").trim() };
  }
  const match = /^([\s\S]+?[.!?]["”)]?)(?:\s+|$)/.exec(text.trim());
  if (!match) return { first: text.trim(), rest: "" };
  return { first: match[1], rest: text.trim().slice(match[0].length).trim() };
}

/** Descrição curta do card e o texto que abre ao clicar: o resumo escrito à mão, ou a primeira frase. */
export function describeChunk(chunk: HelpChunk): { first: string; rest: string } {
  return chunk.summary ? { first: chunk.summary, rest: chunk.text } : splitFirstSentence(chunk.text);
}

export type HelpTextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

/** Quebra o texto em pedaços de texto e links `[rótulo](/rota)`; só rota do próprio app vira link. */
export function parseHelpLinks(text: string): HelpTextPart[] {
  const parts: HelpTextPart[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "link", text: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** Caminho da rota de um trecho, sem a query (`/settings?tab=x` vira `/settings`). */
export const routePath = (route: string): string => route.split("?")[0];

/**
 * Trechos da tela atual: os que apontam para a rota exata; sem nenhum, os da
 * rota mais proxima acima (`/classes/new` cai em `/classes`). Vazio se nada serve.
 */
export function helpForRoute(pathname: string, chunks: HelpChunk[] = HELP_CHUNKS, limit = 8): HelpChunk[] {
  const withRoute = chunks.filter((chunk) => chunk.route);
  const exact = withRoute.filter((chunk) => routePath(chunk.route as string) === pathname);
  if (exact.length > 0) return exact.slice(0, limit);
  let best = "";
  for (const chunk of withRoute) {
    const path = routePath(chunk.route as string);
    if (path !== "/" && pathname.startsWith(`${path}/`) && path.length > best.length) best = path;
  }
  return best ? withRoute.filter((chunk) => routePath(chunk.route as string) === best).slice(0, limit) : [];
}

export const HELP_CHUNKS = kbJson as HelpChunk[];
const DEFAULT_INDEX = buildIndex(HELP_CHUNKS);
