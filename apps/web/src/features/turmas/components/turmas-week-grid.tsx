"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayISO } from "@gestarahub/core/date";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "../calendar-entries";

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

// Cards de aula neutros de proposito: cor por modalidade exigiria uma cor
// definida pelo tenant (Category.color) para ser confiavel — derivar de hash
// colide e passa a mentir sobre agrupamento. Quem separa por modalidade e o
// filtro da tela. A unica cor e a do EVENTO (doc product/29): diz o tipo do
// item, nao a categoria.
const EVENT_CARD = "border-violet-500/40 bg-violet-500/10 hover:border-violet-500/60 hover:bg-violet-500/15";

interface TurmasWeekGridProps {
  days: Date[];
  entries: CalendarEntry[];
}

export function TurmasWeekGrid({ days, entries }: TurmasWeekGridProps) {
  const startTimes = [...new Set(entries.map((s) => s.start))].sort();
  const today = todayISO();

  return (
    <div className="max-h-[68vh] overflow-auto rounded-lg border bg-card">
      {/* `table-fixed`: sem isso a tabela dimensiona por conteudo e o dia cheio
          fica largo enquanto os vazios encolhem — deixa de ser uma grade. */}
      <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 top-0 z-30 w-16 border-b border-r bg-card p-2">
              <span className="sr-only">Horário</span>
            </th>
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const isToday = iso === today;
              return (
                <th
                  key={iso}
                  scope="col"
                  // Sem tinte de "hoje" aqui: o cabecalho e sticky e precisa ser
                  // OPACO (uma cor translucida deixaria os chips aparecerem por
                  // baixo ao rolar). O dia atual e marcado pelo circulo cheio.
                  className="sticky top-0 z-20 border-b border-r bg-card px-2 py-2 last:border-r-0"
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
                const isToday = iso === today;
                const cell = entries
                  .filter((s) => s.date === iso && s.start === start)
                  .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
                return (
                  <td
                    key={iso}
                    className={cn(
                      "border-b border-r p-1.5 align-top last:border-r-0",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <div className="space-y-1.5">
                      {cell.map((entry) => (
                        <Link
                          key={entry.id}
                          href={entry.href}
                          title={`${entry.title} · ${entry.start}–${entry.end} · ${entry.instructorName}`}
                          className={cn(
                            "block rounded-md border px-2 py-1.5 transition-colors",
                            entry.kind === "event" ? EVENT_CARD : "bg-background hover:border-foreground/20 hover:bg-accent",
                          )}
                        >
                          <span className="sr-only">{entry.accessibleLabel}</span>
                          <div aria-hidden="true">
                            <p className="min-w-0 break-words text-xs font-medium leading-tight text-foreground">
                              {entry.kind === "event" ? (
                                <span className="mr-1 inline-flex items-center rounded-sm bg-violet-500/20 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                  Evento
                                </span>
                              ) : null}
                              {entry.title}
                            </p>
                            <p className="min-w-0 break-words text-[0.7rem] leading-tight text-muted-foreground">
                              {entry.start}–{entry.end}
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
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cabecalho de dia usado na visao em lista. */
export function dayLabel(day: Date): string {
  const label = format(day, "EEEE", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
