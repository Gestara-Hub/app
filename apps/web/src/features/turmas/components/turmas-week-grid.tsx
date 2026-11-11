"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { nowTime, todayISO } from "@gestarahub/core/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
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
    <div className="relative rounded-lg border bg-card">
      {edges.left ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-16 z-30 w-6 bg-gradient-to-r from-black/15 to-transparent dark:from-black/40"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-[4.5rem] top-4 z-40 rounded-full shadow-md"
            aria-label="Ver dias anteriores"
            onClick={() => scrollByDay(-1)}
          >
            <ChevronLeft />
          </Button>
        </>
      ) : null}
      {edges.right ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-30 w-6 rounded-r-lg bg-gradient-to-l from-black/15 to-transparent dark:from-black/40"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-2 top-4 z-40 rounded-full shadow-md"
            aria-label="Ver próximos dias"
            onClick={() => scrollByDay(1)}
          >
            <ChevronRight />
          </Button>
        </>
      ) : null}
      <div ref={scrollerRef} onScroll={updateEdges} className="overflow-x-auto rounded-lg xl:overflow-visible">
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
                    // Sem tinte de "hoje" aqui: o cabecalho e sticky e precisa ser
                    // OPACO (uma cor translucida deixaria os chips aparecerem por
                    // baixo ao rolar). O dia atual e marcado pelo circulo cheio.
                    className="sticky top-0 z-20 xl:top-14 border-b border-r bg-card px-2 py-2 last:border-r-0"
                  >
                    <span className="block text-xs font-normal uppercase text-muted-foreground">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span
                      className={cn(
                        "mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {startTimes.map((start) => (
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
                      // Sem fundo no dia de hoje (10/11/2026): com destaque neutro ele
                      // virava cinza de "desativado". O circulo no numero ja marca o dia.
                      className="border-b border-r p-1.5 align-top last:border-r-0"
                    >
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
                                when === "past" && "opacity-60 hover:opacity-100",
                                when === "now" && cn("ring-2 ring-offset-1 ring-offset-card", entryColor(entry, colors).ring),
                              )}
                            >
                              <span className="sr-only">{entry.accessibleLabel}</span>
                              <div aria-hidden="true">
                                <p className="min-w-0 break-words text-xs font-medium leading-tight text-foreground">{entry.title}</p>
                                {/* "Evento" na linha do horario: o titulo fica com a largura toda. */}
                                <p className="min-w-0 break-words text-[0.7rem] leading-tight text-muted-foreground">
                                  {entry.start}–{entry.end}
                                  {entry.kind === "event" ? (
                                    <span className="font-medium text-violet-700 dark:text-violet-300"> · Evento</span>
                                  ) : null}
                                  {/* Ocupacao, ambar quando a turma esta lotada. */}
                                  <span className={cn(entry.isFull && "font-medium text-amber-700 dark:text-amber-400")}>
                                    {" · "}
                                    {entry.isFull ? "Lotada" : entry.occupancyShort}
                                  </span>
                                </p>
                                <p className="min-w-0 break-words text-[0.7rem] leading-tight text-muted-foreground">
                                  {entry.isSubstitute ? (
                                    <span className="font-medium text-amber-700 dark:text-amber-400">{entry.instructorName} (Subst.)</span>
                                  ) : (
                                    <>
                                      {entry.instructorName}
                                      {entry.isGuest ? " (convidado)" : ""}
                                    </>
                                  )}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Cabecalho de dia usado na visao em lista. */
export function dayLabel(day: Date): string {
  const label = format(day, "EEEE", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
