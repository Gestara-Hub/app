"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { nowTime, todayISO } from "@gestarahub/core/date";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "../calendar-entries";
import { EVENT_COLOR, NEUTRAL_MODALITY_COLOR, type ModalityColor } from "../modality-colors";

/**
 * Quadro de horarios da semana: linhas = horario de inicio, colunas = dias.
 *
 * NAO usa posicionamento proporcional ao tempo (como a grade da Agenda do
 * Modelo 1) de proposito. La os horarios sao arbitrarios e a proporcao e o que
 * revela buracos e conflitos; aqui as aulas comecam em horarios redondos e tem
 * duracao parecida, entao a proporcao compra pouco — e custaria a largura:
 * N aulas simultaneas dividiriam a coluna em N e o texto ficaria ilegivel.
 * Empilhando na celula, a linha cresce e nada e espremido.
 *
 * As linhas sao so os horarios que a semana realmente usa, entao nao existe o
 * vao morto entre a aula da manha e a da noite.
 */

// Cor por modalidade (10/11/2026): faixa a esquerda e fundo leve, da ordem de
// criacao das modalidades (`modality-colors.ts`). O roxo e so do EVENTO (doc
// product/29), que diz o tipo do item. Sem modalidade, o card fica neutro.

interface TurmasWeekGridProps {
  days: Date[];
  entries: CalendarEntry[];
  /** Nome da modalidade -> cor (`modalityColorMap`). */
  colors: Map<string, ModalityColor>;
}

/** Cor do card: evento em roxo, aula pela modalidade. */
export function entryColor(entry: CalendarEntry, colors: Map<string, ModalityColor>): ModalityColor {
  if (entry.kind === "event") return EVENT_COLOR;
  return (entry.modalityName && colors.get(entry.modalityName)) || NEUTRAL_MODALITY_COLOR;
}

/** Peso da coluna: dia vazio fica com 1/3 da largura de um dia com aula. */
const FULL_DAY_WEIGHT = 3;
/** Coluna dos horarios (w-16), fixa a esquerda ao rolar. */
const TIME_COLUMN_PX = 64;
const EMPTY_DAY_WEIGHT = 1;

/**
 * Hora atual ("HH:mm"), so no navegador e a cada minuto: no servidor fica
 * `null` (nada esmaecido), para o HTML do servidor e o do navegador baterem.
 */
function useNowTime(): string | null {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowTime());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function TurmasWeekGrid({ days, entries, colors }: TurmasWeekGridProps) {
  const startTimes = [...new Set(entries.map((s) => s.start))].sort();
  const today = todayISO();
  const now = useNowTime();

  // Dias sem nada ficam estreitos e os cheios ganham a largura (10/11/2026).
  const busyDays = new Set(entries.map((e) => e.date));
  const weights = days.map((day) => (busyDays.has(format(day, "yyyy-MM-dd")) ? FULL_DAY_WEIGHT : EMPTY_DAY_WEIGHT));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Rolagem para o lado (celular e telas abaixo de xl, 10/11/2026): sombra na
  // borda e seta flutuante enquanto ha dias escondidos; a seta anda um dia.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Tela larga (xl): a grade nao rola; sobra de texto nao vira "Deslize".
    const scrolls = getComputedStyle(el).overflowX !== "visible";
    const left = scrolls && el.scrollLeft > 4;
    const right = scrolls && el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  // Abre no dia de hoje quando ele esta escondido a direita.
  const weekKey = days.length ? format(days[0], "yyyy-MM-dd") : "";
  useEffect(() => {
    const el = scrollerRef.current;
    const todayCell = el?.querySelector<HTMLElement>("[data-today]");
    if (!el || !todayCell || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, todayCell.offsetLeft - TIME_COLUMN_PX);
    updateEdges();
  }, [weekKey, updateEdges]);

  const scrollByDay = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const columns = el.querySelectorAll<HTMLElement>("thead th[data-day]");
    const width = Array.from(columns).reduce((max, c) => Math.max(max, c.offsetWidth), 0) || el.clientWidth / 2;
    el.scrollBy({ left: direction * width, behavior: "smooth" });
  };

  // Linha de "agora" (11/11/2026): na coluna de hoje, antes do primeiro horario
  // que ainda nao comecou; depois do ultimo, no pe da ultima faixa. A grade nao e
  // proporcional ao tempo: a linha separa o que ja foi do que vem.
  const nextRow = now ? startTimes.findIndex((start) => start > now) : -1;
  const nowLineAtEnd = now !== null && nextRow === -1;
  const nowLineRow = nowLineAtEnd ? startTimes.length - 1 : nextRow;

  // Passado (ja terminou) esmaece; o que esta acontecendo ganha um anel.
  const timing = (entry: CalendarEntry): "past" | "now" | "future" => {
    if (!now) return "future";
    if (entry.date < today) return "past";
    if (entry.date > today) return "future";
    if (entry.end <= now) return "past";
    if (entry.start <= now) return "now";
    return "future";
  };

  return (
    // Sem rolagem propria na vertical (10/11/2026): a pagina rola e o cabecalho
    // dos dias gruda abaixo da barra do topo (top-14). Abaixo de xl a tabela
    // (min 60rem) rola so para o lado.
    <div className="rounded-lg border bg-card">
      {/* Dias escondidos (celular, 11/11/2026): as setas ficam numa faixa acima da
          grade, nao mais flutuando sobre o nome dos dias. */}
      {edges.left || edges.right ? (
        <div className="flex items-center justify-between gap-2 border-b px-1.5 py-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Ver dias anteriores" disabled={!edges.left} onClick={() => scrollByDay(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-xs text-muted-foreground">Deslize para ver os outros dias</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Ver próximos dias" disabled={!edges.right} onClick={() => scrollByDay(1)}>
            <ChevronRight />
          </Button>
        </div>
      ) : null}
      <div className="relative">
      {/* Sombra leve na borda enquanto ha dias escondidos daquele lado. */}
      {edges.left ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-16 z-30 w-3 bg-gradient-to-r from-black/[0.07] to-transparent dark:from-black/30" />
      ) : null}
      {edges.right ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-30 w-3 rounded-br-lg bg-gradient-to-l from-black/[0.07] to-transparent dark:from-black/30" />
      ) : null}
      {/* `relative` (11/11/2026): sem ele, os textos do leitor de tela dos cards
          (sr-only, posicao absoluta) se posicionavam pelo bloco de fora, escapavam
          da rolagem e iam ate 800px para a direita; o Safari do iPhone contava isso
          e encolhia a pagina inteira (zoom out). */}
      <div ref={scrollerRef} onScroll={updateEdges} className="relative overflow-x-auto rounded-b-lg xl:overflow-visible">
        {/* `table-fixed`: sem isso a tabela dimensiona por conteudo e o dia cheio
          fica largo enquanto os vazios encolhem — deixa de ser uma grade. */}
        <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col className="w-16" />
            {days.map((day, i) => (
              <col key={format(day, "yyyy-MM-dd")} style={{ width: `${(weights[i] / totalWeight) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-30 xl:top-14 w-16 border-b border-r bg-card p-2">
                <span className="sr-only">Horário</span>
              </th>
              {days.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const isToday = iso === today;
                return (
                  <th
                    key={iso}
                    scope="col"
                    data-day
                    data-today={isToday || undefined}
                    // Cabecalho sticky e OPACO (uma cor translucida deixaria os chips
                    // aparecerem por baixo ao rolar). Hoje: so o circulo no numero e a linha de "agora".
                    // overflow-hidden (11/11/2026): o nome do dia vazava da coluna estreita
                    // do dia vazio e a grade achava que tinha rolagem ("Deslize").
                    className="sticky top-0 z-20 xl:top-14 overflow-hidden border-b border-r bg-card px-2 py-2 last:border-r-0"
                  >
                    <span className="block text-xs font-normal uppercase text-muted-foreground" title={format(day, "EEEE", { locale: ptBR })}>
                      {/* Dia vazio fica estreito: so as 3 primeiras letras ("dom"). */}
                      {busyDays.has(iso) ? format(day, "EEE", { locale: ptBR }) : format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1.5">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                          isToday && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {startTimes.map((start, rowIndex) => (
              <tr key={start}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-16 border-b border-r bg-card px-2 align-top text-xs font-normal tabular-nums text-muted-foreground"
                >
                  <span className="block pt-3">{start}</span>
                </th>
                {days.map((day) => {
                  const iso = format(day, "yyyy-MM-dd");
                  const cell = entries
                    .filter((s) => s.date === iso && s.start === start)
                    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
                  return (
                    <td
                      key={iso}
                      className="border-b border-r p-1.5 align-top last:border-r-0"
                    >
                      {iso === today && now && nowLineRow === rowIndex && !nowLineAtEnd ? <NowLine time={now} /> : null}
                      <div className="space-y-1.5">
                        {cell.map((entry) => {
                          const when = timing(entry);
                          return (
                            <Link
                              key={entry.id}
                              href={entry.href}
                              title={`${entry.title} · ${entry.start}–${entry.end} · ${entry.instructorName}`}
                              className={cn(
                                "block rounded-md border border-l-[3px] px-2 py-1.5 transition-[colors,opacity]",
                                entryColor(entry, colors).card,
                                when === "past" && "opacity-55 hover:opacity-100",
                                when === "now" && cn("ring-2 ring-offset-1 ring-offset-card", entryColor(entry, colors).ring),
                              )}
                            >
                              <span className="sr-only">{entry.accessibleLabel}</span>
                              <div aria-hidden="true">
                                {entry.kind === "event" ? (
                                  <div className="mb-1 flex min-w-0 items-center gap-1.5">
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-violet-500/20 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                      <Ticket className="size-2.5" />
                                      Evento
                                    </span>
                                    {entry.modalityName ? (
                                      <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                        <span
                                          className={cn(
                                            "size-1.5 shrink-0 rounded-full",
                                            colors.get(entry.modalityName)?.dot ?? NEUTRAL_MODALITY_COLOR.dot,
                                          )}
                                        />
                                        <span className="truncate">{entry.modalityName}</span>
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                <p className="min-w-0 break-words text-xs font-medium leading-tight text-foreground">{entry.title}</p>
                                {/* Ocupacao + horario; ambar quando a turma ou o evento esta lotado. */}
                                <p className="min-w-0 break-words text-[0.7rem] leading-tight text-muted-foreground">
                                  {entry.start}–{entry.end}
                                  <span className={cn(entry.isFull && "font-medium text-amber-700 dark:text-amber-400")}>
                                    {" · "}
                                    {entry.isFull ? (entry.kind === "event" ? "Lotado" : "Lotada") : entry.occupancyShort}
                                  </span>
                                </p>
                                <p className="min-w-0 truncate text-[0.7rem] leading-tight text-muted-foreground">
                                  {entry.isSubstitute ? (
                                    <span className="font-medium text-amber-700 dark:text-amber-400">{entry.instructorName} (Subst.)</span>
                                  ) : (
                                    <>
                                      {entry.instructorShort ?? entry.instructorName}
                                      {entry.isGuest ? " (convidado)" : ""}
                                    </>
                                  )}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {iso === today && now && nowLineAtEnd && rowIndex === startTimes.length - 1 ? <NowLine time={now} atEnd /> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

/** Cabecalho de dia usado na visao em lista. */
export function dayLabel(day: Date): string {
  const label = format(day, "EEEE", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Linha de "agora" na coluna de hoje: bolinha, a hora e o traco, na cor de atraso. Sem posicao absoluta (ver doc 07, mobile). */
function NowLine({ time, atEnd = false }: { time: string; atEnd?: boolean }) {
  return (
    <div
      role="presentation"
      title={`Agora, ${time}`}
      className={cn("-mx-1.5 flex items-center gap-1 text-overdue", atEnd ? "mt-1.5 -mb-1" : "-mt-1 mb-1.5")}
    >
      <span className="size-2 shrink-0 rounded-full bg-overdue" aria-hidden />
      <span className="text-[10px] font-semibold leading-none tabular-nums">{time}</span>
      <span className="h-px flex-1 bg-overdue" aria-hidden />
    </div>
  );
}
