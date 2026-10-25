"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bug, ChevronDown, CircleHelp, Lightbulb, LifeBuoy, PlayCircle, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { canAccessRoute } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentUser, useModel } from "@/features/auth";
import { cn } from "@/lib/utils";
import { screenName } from "@/lib/support/screen-names";
import { HELP_CHUNKS, describeChunk, helpForRoute, parseHelpLinks, routePath, searchHelp, type HelpChunk } from "@/lib/support/help-search";
import { replayTour, startGuide } from "../help-events";
import { useLogHelpEvent } from "../hooks/use-help-events";
import { openSupport } from "../support-events";

const FALLBACK_ARTICLE = "Primeiros passos";

/** Buscas que mais se repetem; um toque preenche o campo. */
const COMMON_SEARCHES = ["Cadastrar um aluno", "Marcar cobrança como paga", "Fazer a chamada", "Enviar mensagem no WhatsApp"];

/** Espera a pessoa parar de digitar antes de contar uma busca sem resultado. */
const MISS_DELAY_MS = 1500;

/**
 * Ajuda do app (doc technical/26, 18.2): dúvidas da tela atual e busca livre
 * nos artigos de docs/ajuda, sem IA e sem custo. Os passos têm link para a tela,
 * cada card pergunta "Isso ajudou?" e a busca sem resultado fica registrada
 * (sem dado pessoal) para o time saber que artigo escrever.
 */
export function HelpSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const model = useModel();
  const logEvent = useLogHelpEvent();
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const loggedMisses = useRef(new Set<string>());

  // Só o que a pessoa pode abrir: professor não vê dúvida de tela que o menu dele não tem.
  const allowed = useMemo(
    () => (chunk: HelpChunk) => !chunk.route || canAccessRoute(user, routePath(chunk.route), model),
    [user, model],
  );
  const suggestions = useMemo(() => {
    // Quem tem guia na tela ("Me mostre") vem primeiro; a ordem do artigo se mantém dentro de cada grupo.
    const here = helpForRoute(pathname, HELP_CHUNKS.filter(allowed), 24)
      .sort((a, b) => Number(Boolean(b.guide)) - Number(Boolean(a.guide)))
      .slice(0, 12);
    return here.length > 0 ? here : HELP_CHUNKS.filter((chunk) => chunk.article === FALLBACK_ARTICLE && allowed(chunk)).slice(0, 4);
  }, [pathname, allowed]);
  const results = useMemo(() => (typed.length >= 2 ? searchHelp(typed, 8).filter(allowed).slice(0, 5) : null), [typed, allowed]);
  // Um título por tela (o mesmo do título da página; sem rota, o nome do artigo), em vez de repetido em cada card.
  const groups = useMemo(() => {
    const byScreen = new Map<string, HelpChunk[]>();
    for (const chunk of results ?? suggestions) {
      const name = screenName(chunk.route) ?? chunk.article;
      byScreen.set(name, [...(byScreen.get(name) ?? []), chunk]);
    }
    return [...byScreen].map(([article, chunks]) => ({ article, chunks }));
  }, [results, suggestions]);

  const missed = results !== null && results.length === 0;
  useEffect(() => {
    if (!open || !missed || typed.length < 3) return;
    const term = typed.toLowerCase();
    if (loggedMisses.current.has(term)) return;
    const timer = setTimeout(() => {
      loggedMisses.current.add(term);
      logEvent({ kind: "miss", term: typed, route: pathname });
    }, MISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, missed, typed, pathname, logEvent]);

  function askSupport() {
    onOpenChange(false);
    openSupport({ draft: typed || undefined });
  }
  function openKind(kind: "bug" | "suggestion") {
    onOpenChange(false);
    openSupport({ kind });
  }
  const canReplayTour = pathname === "/dashboard" && user.profile === "owner";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Fechou a ajuda: a próxima abertura volta às dúvidas da tela.
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/60 p-0 shadow-2xl sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border/40 p-5 pb-4 pr-14 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <CircleHelp className="size-5 text-primary" /> Ajuda
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">Passo a passo do que o sistema faz.</SheetDescription>
        </SheetHeader>

        <div className="shrink-0 space-y-2.5 border-b border-border/40 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 120))}
              placeholder="Pergunte ou busque, como cadastrar um aluno"
              aria-label="Buscar na ajuda"
              className="pl-9 text-base md:text-sm"
            />
          </div>
          {typed.length === 0 ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Buscas comuns">
              {COMMON_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="cursor-pointer rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          <p className="text-xs font-medium text-muted-foreground">
            {results ? (results.length > 0 ? "Resultados" : "") : "Dúvidas desta tela"}
            {groups.length === 1 && groups[0].article ? ` · ${groups[0].article}` : ""}
          </p>
          {missed ? (
            <p className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">
              Não encontramos nada sobre isso na ajuda. Conte para a gente e respondemos.
            </p>
          ) : null}
          {groups.map((group) => (
            <section key={group.article} className="space-y-2">
              {groups.length > 1 ? <h2 className="pt-1 text-xs font-medium text-muted-foreground">{group.article}</h2> : null}
              {group.chunks.map((chunk) => (
                <HelpCard
                  key={chunk.id}
                  chunk={chunk}
                  canOpen={results !== null}
                  onNavigate={() => onOpenChange(false)}
                  onVote={(kind) => logEvent({ kind, chunkId: chunk.id, route: pathname })}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/40 p-4">
          <Button variant={missed ? "default" : "outline"} className="w-full" onClick={askSupport}>
            <LifeBuoy className="size-4" /> {typed ? "Não achou? Falar com a gente" : "Falar com a gente"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => openKind("bug")}>
              <Bug className="size-4" /> Relatar problema
            </Button>
            <Button variant="ghost" onClick={() => openKind("suggestion")}>
              <Lightbulb className="size-4" /> Sugerir melhoria
            </Button>
          </div>
          {canReplayTour ? (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                replayTour();
              }}
            >
              <PlayCircle className="size-4" /> Rever o tour do Painel
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Texto do passo a passo; `[rótulo](/rota)` vira link para a tela. */
function HelpText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
      {parseHelpLinks(text).map((part, i) =>
        part.kind === "link" ? (
          <Link key={i} href={part.href} onClick={onNavigate} className="font-medium text-foreground underline underline-offset-2">
            {part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function HelpCard({
  chunk,
  canOpen,
  onNavigate,
  onVote,
}: {
  chunk: HelpChunk;
  canOpen: boolean;
  onNavigate: () => void;
  onVote: (kind: "helpful" | "not_helpful") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [voted, setVoted] = useState<"helpful" | "not_helpful" | null>(null);
  const { first, rest } = describeChunk(chunk);
  // Só nos resultados da busca, que podem ser de outra tela; as dúvidas da tela atual já são dela.
  const showLink = canOpen && Boolean(chunk.route);
  return (
    <article className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-start gap-2 p-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold">{chunk.title}</span>
          <span className="mt-1.5 block break-words text-sm text-muted-foreground">{first}</span>
        </span>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {chunk.guide ? (
        <div className="px-3.5 pb-3.5">
          <Button type="button" variant="outline" onClick={() => startGuide(chunk.id)}>
            <PlayCircle className="size-4" /> Me mostre na tela
          </Button>
        </div>
      ) : null}
      {expanded ? (
        <div className="space-y-3 px-3.5 pb-3.5">
          {rest ? <HelpText text={rest} onNavigate={onNavigate} /> : null}
          {showLink ? (
            <Button asChild variant="link" className="h-auto p-0">
              <Link href={chunk.route as string} onClick={onNavigate}>
                Abrir esta tela <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : null}
          <div className="flex items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
            {voted ? (
              <span>Obrigado pelo retorno.</span>
            ) : (
              <>
                <span>Isso ajudou?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Ajudou"
                  onClick={() => {
                    setVoted("helpful");
                    onVote("helpful");
                  }}
                >
                  <ThumbsUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Não ajudou"
                  onClick={() => {
                    setVoted("not_helpful");
                    onVote("not_helpful");
                  }}
                >
                  <ThumbsDown className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
