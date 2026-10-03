"use client";

import { useState } from "react";
import type { FinanceMonthPoint } from "@gestarahub/contracts";
import { formatCents } from "@gestarahub/core/format";
import { cn } from "@/lib/utils";
import { competenceLabel, competenceShortLabel } from "../lib";

// Geometria do SVG (unidades do viewBox; o SVG escala com a largura).
const WIDTH = 640;
const HEIGHT = 220;
// `left` reserva a coluna do eixo Y (valores).
const PAD = { top: 12, right: 8, bottom: 26, left: 64 };
const BAR_WIDTH = 14;
const BAR_GAP = 2;

/** Arredonda o topo da escala para um valor "redondo" (1, 2, 5 x 10^n). */
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const COMPACT_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Centavos -> rotulo curto do eixo ("R$ 1,5 mil"). */
function axisLabel(cents: number): string {
  return cents === 0 ? "R$ 0" : COMPACT_BRL.format(cents / 100);
}

/** Barra com o topo arredondado (4px) ancorada na linha base. */
function barPath(x: number, yTop: number, yBase: number, width: number): string {
  const h = yBase - yTop;
  if (h <= 0) return "";
  const r = Math.min(4, h, width / 2);
  return [
    `M${x},${yBase}`,
    `V${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `H${x + width - r}`,
    `Q${x + width},${yTop} ${x + width},${yTop + r}`,
    `V${yBase}`,
    "Z",
  ].join(" ");
}

/**
 * Grafico entradas x saidas (barras) com a linha do resultado, um eixo so.
 * SVG proprio (sem dependencia); cores do tema (chart-2 = entradas, chart-1 =
 * saidas, foreground = resultado). Hover mostra o detalhe do mes; a tabela
 * escondida serve aos leitores de tela.
 */
export function FinanceCashFlowChart({ points }: { points: FinanceMonthPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const maxValue = Math.max(0, ...points.flatMap((p) => [p.incomeCents, p.expenseCents, p.resultCents]));
  const minValue = Math.min(0, ...points.map((p) => p.resultCents));
  const top = niceCeil(maxValue) || 1;
  const bottom = minValue < 0 ? -niceCeil(-minValue) : 0;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * plotH;
  const baseY = y(0);
  const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, points.length);
  const center = (i: number) => PAD.left + slot * i + slot / 2;

  // Eixo Y: topo, metade, zero e (se houver resultado negativo) o fundo.
  const ticks = [top, top / 2, 0, bottom].filter((v, i, arr) => arr.indexOf(v) === i);

  const linePoints = points.map((p, i) => `${center(i)},${y(p.resultCents)}`).join(" ");
  const activePoint = active !== null ? points[active] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-2" /> Entradas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" /> Saídas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-foreground" /> Resultado
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label="Entradas e saídas dos últimos meses, com o resultado de cada mês"
        >
          {/* grade recessiva com os valores do eixo Y */}
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? "stroke-border" : "stroke-border/50"}
                strokeDasharray={v === 0 ? undefined : "3 3"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {axisLabel(v)}
              </text>
            </g>
          ))}

          {points.map((p, i) => {
            const cx = center(i);
            const incomeX = cx - BAR_WIDTH - BAR_GAP / 2;
            const expenseX = cx + BAR_GAP / 2;
            return (
              <g key={p.competence}>
                {active === i ? (
                  <rect
                    x={cx - slot / 2 + 2}
                    y={PAD.top}
                    width={slot - 4}
                    height={plotH}
                    rx={6}
                    className="fill-muted/60"
                  />
                ) : null}
                <path d={barPath(incomeX, y(p.incomeCents), baseY, BAR_WIDTH)} className="fill-chart-2" />
                <path d={barPath(expenseX, y(p.expenseCents), baseY, BAR_WIDTH)} className="fill-chart-1" />
                <text
                  x={cx}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className={cn("fill-muted-foreground text-[11px]", active === i && "fill-foreground font-medium")}
                >
                  {competenceShortLabel(p.competence)}
                </text>
              </g>
            );
          })}

          {points.length > 1 ? (
            <polyline
              points={linePoints}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((p, i) => (
            <circle
              key={p.competence}
              cx={center(i)}
              cy={y(p.resultCents)}
              r={active === i ? 5 : 4}
              className="fill-foreground stroke-card"
              strokeWidth={2}
            />
          ))}

          {/* alvos de hover maiores que as marcas */}
          {points.map((p, i) => (
            <rect
              key={p.competence}
              x={center(i) - slot / 2}
              y={0}
              width={slot}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive((prev) => (prev === i ? null : i))}
            />
          ))}
        </svg>

        {activePoint && active !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-lg border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
            style={{
              left: `${Math.min(85, Math.max(15, (center(active) / WIDTH) * 100))}%`,
            }}
          >
            <p className="mb-1.5 font-medium">{competenceLabel(activePoint.competence)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular-nums">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-sm bg-chart-2" /> Entradas
              </dt>
              <dd className="text-right">{formatCents(activePoint.incomeCents)}</dd>
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-sm bg-chart-1" /> Saídas
              </dt>
              <dd className="text-right">{formatCents(activePoint.expenseCents)}</dd>
              <dt className="text-muted-foreground">Resultado</dt>
              <dd className="text-right font-medium">{formatCents(activePoint.resultCents)}</dd>
            </dl>
          </div>
        ) : null}
      </div>

      <table className="sr-only">
        <caption>Entradas, saídas e resultado por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Entradas</th>
            <th scope="col">Saídas</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.competence}>
              <th scope="row">{competenceLabel(p.competence)}</th>
              <td>{formatCents(p.incomeCents)}</td>
              <td>{formatCents(p.expenseCents)}</td>
              <td>{formatCents(p.resultCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
