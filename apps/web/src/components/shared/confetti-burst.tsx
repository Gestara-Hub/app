import { cn } from "@/lib/utils";

const COLORS = ["#c026d3", "#db2777", "#f59e0b", "#10b981", "#3b82f6", "#ffffff"];

interface Piece {
  x: number;
  y: number;
  rotate: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
}

// Pseudo-aleatorio deterministico: o mesmo confete no server e no client.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildPieces(count: number): Piece[] {
  const rand = seeded(42);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
    const distance = 90 + rand() * 170;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.6 - 40,
      rotate: (rand() - 0.5) * 720,
      delay: rand() * 150,
      size: 6 + rand() * 6,
      color: COLORS[i % COLORS.length],
      round: rand() > 0.6,
    };
  });
}

const PIECES = buildPieces(44);

/**
 * Explosao de confete em CSS puro (sem lib), a partir do centro do container
 * pai (que precisa ser `relative`). Some sozinha; respeita reduzir movimento.
 */
export function ConfettiBurst({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden",
        className,
      )}
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 animate-confetti opacity-0"
          style={
            {
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              backgroundColor: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}ms`,
              "--confetti-x": `${p.x}px`,
              "--confetti-y": `${p.y}px`,
              "--confetti-r": `${p.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
