import { useMemo } from "react";

const SIZE = 25;

/** Semente deterministica a partir do texto (FNV-1a). */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function isFinder(x: number, y: number): boolean {
  const inBox = (bx: number, by: number) =>
    x >= bx && x < bx + 7 && y >= by && y < by + 7;
  return inBox(0, 0) || inBox(SIZE - 7, 0) || inBox(0, SIZE - 7);
}

/** Separador branco em volta dos marcadores de canto. */
function isFinderMargin(x: number, y: number): boolean {
  const near = (bx: number, by: number) =>
    x >= bx - 1 && x <= bx + 7 && y >= by - 1 && y <= by + 7;
  return near(0, 0) || near(SIZE - 7, 0) || near(0, SIZE - 7);
}

/** Modulos "aleatorios" (xorshift32) fora dos marcadores de canto. */
function buildCells(value: string): { x: number; y: number }[] {
  let state = seedOf(value) || 1;
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const r = (state >>> 0) / 0xffffffff;
      if (isFinder(x, y) || isFinderMargin(x, y)) continue;
      if (r < 0.5) out.push({ x, y });
    }
  }
  return out;
}

/**
 * QR ILUSTRATIVO (nao e lido por app de banco): padrao gerado do texto, com os
 * tres marcadores de canto, so para a tela lembrar um QR de Pix. Sem dependencia.
 */
export function IllustrativeQr({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const cells = useMemo(() => buildCells(value), [value]);

  const finders = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ] as const;

  return (
    <svg
      viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`}
      role="img"
      aria-label="QR Code ilustrativo"
      className={className}
      shapeRendering="crispEdges"
    >
      <rect
        x={-1}
        y={-1}
        width={SIZE + 2}
        height={SIZE + 2}
        className="fill-background"
      />
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width={1}
          height={1}
          className="fill-foreground"
        />
      ))}
      {finders.map(([fx, fy]) => (
        <g key={`${fx}-${fy}`}>
          <rect
            x={fx}
            y={fy}
            width={7}
            height={7}
            className="fill-foreground"
          />
          <rect
            x={fx + 1}
            y={fy + 1}
            width={5}
            height={5}
            className="fill-background"
          />
          <rect
            x={fx + 2}
            y={fy + 2}
            width={3}
            height={3}
            className="fill-foreground"
          />
        </g>
      ))}
    </svg>
  );
}
