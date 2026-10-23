import { fingerprintOf, maskText, maskValue, newReference } from "./mask";

/**
 * Registro de erros (doc technical/21). Uma porta so, no servidor e no
 * navegador, com a mesma forma de chamada do `console.error`:
 *
 *   logError("[cron:daily] Mensalidades falharam no espaço", err);
 *   reportError("turmas.markAttendance", err, { organizationId, context });
 *
 * O texto e mascarado (sem CPF, token, senha), sai sempre no console (no
 * servidor, uma linha JSON no log da Vercel) e vai para o destino registrado:
 * no servidor, a tabela `error_logs` (`server-sink.ts`, ligado no
 * `instrumentation.ts`); no navegador, uma acao do servidor com limite de
 * envio (ligada no layout do app). Sem destino (testes), so o console.
 * Registrar erro nunca lanca nem derruba a operacao.
 */

export type ErrorSource = "server" | "browser" | "cron" | "webhook";
export type ErrorLevel = "error" | "warn";

export interface ErrorEntry {
  level: ErrorLevel;
  source: ErrorSource;
  event: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  /** So no servidor, de fonte confiavel (sessao, rotina). O navegador nunca manda. */
  organizationId?: string;
  userId?: string;
  fingerprint: string;
  reference: string;
}

type ErrorSink = (entry: ErrorEntry) => Promise<void>;
let sink: ErrorSink | undefined;

/** Liga o destino (servidor: banco; navegador: acao do servidor). */
export function setErrorSink(next: ErrorSink | undefined): void {
  sink = next;
}

type ScopeRunner = <T>(fn: () => Promise<T>) => Promise<T>;
let scopeRunner: ScopeRunner | undefined;

/** Liga o escopo por requisicao (so no servidor; `server-sink.ts`). */
export function setErrorScopeRunner(next: ScopeRunner | undefined): void {
  scopeRunner = next;
}

/**
 * Roda `fn` num escopo de requisicao: erros registrados dentro dele saem com o
 * espaco e o usuario da sessao (anotados por `requireTenant`).
 */
export function withErrorScope<T>(fn: () => Promise<T>): Promise<T> {
  return scopeRunner ? scopeRunner(fn) : fn();
}

const isServer = typeof window === "undefined";

export interface ReportOptions {
  level?: ErrorLevel;
  source?: ErrorSource;
  organizationId?: string;
  userId?: string;
  context?: Record<string, unknown>;
  /** Codigo ja mostrado ao usuario (senao, um novo). */
  reference?: string;
}

/**
 * Registra um erro com evento e contexto. Devolve o codigo curto para mostrar
 * ao usuario. A gravacao no destino e aguardada (no servidor, a funcao pode
 * congelar logo depois da resposta), com prazo curto.
 */
export function reportError(event: string, error: unknown, options: ReportOptions = {}): Promise<string> {
  return report(buildEntry(event, error, options));
}

async function report(entry: ErrorEntry): Promise<string> {
  writeConsole(entry);
  if (sink) {
    try {
      await Promise.race([sink(entry), new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
    } catch {
      // O destino falhou (banco fora, rede): a linha do console ja ficou.
    }
  }
  return entry.reference;
}

/** Igual ao `console.error`, com registro: "[evento] texto", erro e detalhes. */
export function logError(...args: unknown[]): void {
  void logFromArgs("error", args);
}

/** Igual ao `console.warn`, com registro (nivel aviso). */
export function logWarn(...args: unknown[]): void {
  void logFromArgs("warn", args);
}

function logFromArgs(level: ErrorLevel, args: unknown[]): Promise<string> {
  const [first, ...rest] = args;
  let event = isServer ? "server" : "browser";
  let message = "";
  if (typeof first === "string") {
    const tagged = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(first);
    if (tagged) {
      event = tagged[1];
      message = tagged[2];
    } else {
      message = first;
    }
  } else if (first !== undefined) {
    rest.unshift(first);
  }
  const error = rest.find((item) => item instanceof Error);
  const details = rest.filter((item) => item !== error);
  // Numeros e textos soltos (status, corpo da resposta) entram na mensagem.
  const inline = details.filter((item) => typeof item === "string" || typeof item === "number");
  const objects = details.filter((item) => typeof item === "object" && item !== null);
  const text = [message.replace(/:\s*$/, ""), ...inline.map(String), error ? (error as Error).message : ""]
    .filter(Boolean)
    .join(": ");
  return report(
    buildEntry(
      event,
      error ?? new Error(text || "erro sem mensagem"),
      { level, context: objects.length > 0 ? { details: objects.length === 1 ? objects[0] : objects } : undefined },
      text || undefined,
    ),
  );
}

function buildEntry(event: string, error: unknown, options: ReportOptions, messageOverride?: string): ErrorEntry {
  const err = error instanceof Error ? error : undefined;
  const raw =
    messageOverride ??
    (err ? err.message : typeof error === "string" ? error : safeJson(error)) ??
    "erro sem mensagem";
  const message = maskText(raw);
  const stack = err?.stack ? maskText(err.stack) : undefined;
  const cause = err && "cause" in err && err.cause ? { cause: maskValue(err.cause) } : {};
  const errorCode = (err as { code?: unknown } | undefined)?.code;
  const code = typeof errorCode === "string" ? { code: errorCode } : {};
  const context = { ...code, ...cause, ...((maskValue(options.context ?? {}) as Record<string, unknown>) ?? {}) };
  return {
    level: options.level ?? "error",
    source: options.source ?? (isServer ? "server" : "browser"),
    event: event.slice(0, 200),
    message,
    stack,
    context: Object.keys(context).length > 0 ? context : undefined,
    organizationId: options.organizationId,
    userId: options.userId,
    fingerprint: fingerprintOf(event, message, stack),
    reference: options.reference ?? newReference(),
  };
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/** Producao: uma linha JSON (filtravel no log da Vercel). Desenvolvimento: texto legivel. */
function writeConsole(entry: ErrorEntry): void {
  const write = entry.level === "warn" ? console.warn : console.error;
  if (isServer && process.env.NODE_ENV === "production") {
    write(
      JSON.stringify({
        level: entry.level,
        source: entry.source,
        event: entry.event,
        message: entry.message,
        reference: entry.reference,
        organizationId: entry.organizationId,
        userId: entry.userId,
        context: entry.context,
        stack: entry.stack,
      }),
    );
    return;
  }
  write(`[${entry.event}] ${entry.message} (código ${entry.reference})`, entry.stack ?? "", entry.context ?? "");
}
