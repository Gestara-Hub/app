"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { todayISO } from "@gestarahub/core/date";
import type { ClassSessionView } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";

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

// Cards neutros de proposito: cor por modalidade exigiria uma cor definida pelo
// tenant (Category.color) para ser confiavel — derivar de hash colide e passa a
// mentir sobre agrupamento. Quem separa por modalidade e o filtro da tela. Se
// cor voltar, vale mais para ESTADO (lotada, cancelada) do que para categoria.

interface TurmasWeekGridProps {
  days: Date[];
  sessions: ClassSessionView[];
}

export function TurmasWeekGrid({ days, sessions }: TurmasWeekGridProps) {
  const startTimes = [...new Set(sessions.map((s) => s.start))].sort();
  const today = todayISO();

  return (
    <div className="max-h-[68vh] overflow-auto rounded-lg border bg-card">
      {/* `table-fixed`: sem isso a tabela dimensiona por conteudo e o dia cheio
          fica largo enquanto os vazios encolhem — deixa de ser uma grade. */}
      <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-16 border-b border-r bg-card p-2" />
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
                const cell = sessions
                  .filter((s) => s.date === iso && s.start === start)
                  .sort((a, b) => a.className.localeCompare(b.className, "pt-BR"));
                return (
                  <td
                    key={iso}
                    className={cn(
                      "border-b border-r p-1.5 align-top last:border-r-0",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <div className="space-y-1.5">
                      {cell.map((session) => {
                        return (
                          <Link
                            key={session.id}
                            href={`/classes/sessions/${encodeURIComponent(session.id)}`}
                            title={`${session.className} · ${session.start}–${session.end} · ${session.instructorName}`}
                            className="block rounded-md border bg-background px-2 py-1.5 transition-colors hover:border-foreground/20 hover:bg-accent"
                          >
                            <p className="truncate text-xs font-medium leading-tight text-foreground">
                              {session.className}
                            </p>
                            <p className="truncate text-[0.7rem] leading-tight text-muted-foreground">
                              {session.start}–{session.end}
                            </p>
                            <p className="truncate text-[0.7rem] leading-tight text-muted-foreground">
                              {session.isSubstitute ? (
                                <span className="font-medium text-amber-600 dark:text-amber-400">
                                  {session.instructorName} (Subst.)
                                </span>
                              ) : (
                                session.instructorName
                              )}
                            </p>
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
  );
}

/** Cabecalho de dia usado na visao em lista. */
export function dayLabel(day: Date): string {
  const label = format(day, "EEEE", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
