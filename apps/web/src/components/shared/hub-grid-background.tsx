"use client";

import { useEffect, useRef } from "react";

/** Lado (px) de cada quadrado da malha. */
const CELL = 44;
/** Cores do logo (azul-piscina, roxo, magenta, laranja). */
const COLORS = ["37,180,184", "138,27,158", "226,47,121", "247,148,29"];
/** Rastro (ms) de cada pulso e raio (px) dos nos acesos perto do cursor. */
const TRAIL_MS = 420;
const NODE_RADIUS = 140;
/** Pulsos lentos, finos e apagados: o efeito fica no fundo, sem disputar com o formulario. */
const SPEED = 0.11;
const SPEED_JITTER = 0.07;
const TRAIL_ALPHA = 0.4;
const NODE_ALPHA = 0.4;
/** Um pulso nasce a cada 3 quadrados andados pelo mouse e um solto a cada 1,1 s. */
const EMIT_EVERY_CELLS = 3;
const AMBIENT_MS = 1100;
/** Direcoes pela malha: direita, baixo, esquerda, cima. */
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

type Pulse = {
  x: number;
  y: number;
  dir: number;
  speed: number;
  color: string;
  /** Distancia ate o proximo cruzamento. */
  toNext: number;
  /** Cruzamentos que ainda percorre antes de apagar. */
  hops: number;
  dead: boolean;
  trail: { x: number; y: number; t: number }[];
};

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * Fundo das telas de entrada: uma malha onde pulsos de luz, nas cores do logo,
 * correm pelas linhas ate o cartao marcado com `data-hub-target` (o "hub") e
 * somem ao chegar. Os cruzamentos perto do mouse acendem como nos, o mouse
 * solta pulsos e um clique no fundo dispara alguns. Sobre o cartao nada
 * acontece. O laco de animacao para quando nao ha pulso nem mouse. Sem mouse
 * (toque) ou com movimento reduzido, fica so a malha parada.
 */
export function HubGridBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!el || !canvas || !ctx) return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = el.clientWidth * ratio;
      canvas.height = el.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    let pulses: Pulse[] = [];
    let card: Box | null = null;
    let mouse: { x: number; y: number } | null = null;
    let lastEmit: { x: number; y: number } | null = null;
    let colorIndex = 0;
    let loop = 0;
    let previous = 0;

    const measureCard = () => {
      const box = el.getBoundingClientRect();
      const target = el.parentElement?.querySelector("[data-hub-target]")?.getBoundingClientRect();
      card = target
        ? { left: target.left - box.left, top: target.top - box.top, right: target.right - box.left, bottom: target.bottom - box.top }
        : null;
    };

    /** Direcao que leva do ponto ao centro do cartao. */
    const towardCard = (x: number, y: number) => {
      if (!card) return Math.floor(Math.random() * 4);
      const dx = (card.left + card.right) / 2 - x;
      const dy = (card.top + card.bottom) / 2 - y;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
    };

    const spawn = (x: number, y: number, dir: number) => {
      const sx = Math.round(x / CELL) * CELL;
      const sy = Math.round(y / CELL) * CELL;
      pulses.push({
        x: sx,
        y: sy,
        dir,
        speed: SPEED + Math.random() * SPEED_JITTER,
        color: COLORS[colorIndex++ % COLORS.length],
        toNext: CELL,
        hops: 40,
        dead: false,
        trail: [{ x: sx, y: sy, t: performance.now() }],
      });
      if (pulses.length > 60) pulses.shift();
      wake();
    };

    const advance = (p: Pulse, distance: number, now: number) => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      while (!p.dead && distance > 0) {
        const move = Math.min(distance, p.toNext);
        p.x += DIRECTIONS[p.dir][0] * move;
        p.y += DIRECTIONS[p.dir][1] * move;
        p.toNext -= move;
        distance -= move;
        if (p.toNext <= 0) {
          // Chegou num cruzamento: marca a esquina no rastro e talvez vire.
          p.trail.push({ x: p.x, y: p.y, t: now });
          p.toNext = CELL;
          p.hops -= 1;
          if (p.hops <= 0 || p.x < -CELL || p.y < -CELL || p.x > width + CELL || p.y > height + CELL) p.dead = true;
          else if (card && Math.random() < 0.6) {
            // Puxa para o cartao, sem dar meia-volta.
            const toward = towardCard(p.x, p.y);
            if (toward !== (p.dir + 2) % 4) p.dir = toward;
          } else if (Math.random() < 0.35) p.dir = (p.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
        }
        if (card && p.x > card.left && p.x < card.right && p.y > card.top && p.y < card.bottom) p.dead = true;
      }
      p.trail.push({ x: p.x, y: p.y, t: now });
      p.trail = p.trail.filter((point, index) => index === p.trail.length - 1 || now - point.t < TRAIL_MS);
    };

    const frame = (now: number) => {
      const dt = previous ? Math.min(48, now - previous) : 16;
      previous = now;
      const dark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, el.clientWidth, el.clientHeight);
      measureCard();

      // Nos perto do cursor.
      if (mouse) {
        const i0 = Math.floor((mouse.x - NODE_RADIUS) / CELL);
        const i1 = Math.ceil((mouse.x + NODE_RADIUS) / CELL);
        const j0 = Math.floor((mouse.y - NODE_RADIUS) / CELL);
        const j1 = Math.ceil((mouse.y + NODE_RADIUS) / CELL);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const d = Math.hypot(i * CELL - mouse.x, j * CELL - mouse.y);
            if (d >= NODE_RADIUS) continue;
            const v = (1 - d / NODE_RADIUS) ** 2;
            ctx.fillStyle = `rgba(${COLORS[Math.abs(i + j) % COLORS.length]},${v * (dark ? 0.9 : 0.75) * NODE_ALPHA})`;
            ctx.beginPath();
            ctx.arc(i * CELL, j * CELL, 1.2 + v * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Pulsos: rastro que some com o tempo e a cabeca com um brilho leve.
      ctx.lineCap = "round";
      for (const p of pulses) {
        if (!p.dead) advance(p, p.speed * dt, now);
        else p.trail = p.trail.filter((point) => now - point.t < TRAIL_MS);
        for (let k = 1; k < p.trail.length; k++) {
          const a = p.trail[k - 1];
          const b = p.trail[k];
          const v = Math.max(0, 1 - (now - a.t) / TRAIL_MS);
          ctx.strokeStyle = `rgba(${p.color},${v * (dark ? 0.9 : 0.75) * TRAIL_ALPHA})`;
          ctx.lineWidth = 1 + v * 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        if (!p.dead) {
          ctx.shadowColor = `rgb(${p.color})`;
          ctx.shadowBlur = 6;
          ctx.fillStyle = `rgba(${p.color},0.7)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      pulses = pulses.filter((p) => !p.dead || p.trail.length > 1);

      if (pulses.length > 0 || mouse) loop = requestAnimationFrame(frame);
      else {
        loop = 0;
        previous = 0;
      }
    };
    function wake() {
      if (!loop) loop = requestAnimationFrame(frame);
    }

    const local = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      return { x: e.clientX - box.left, y: e.clientY - box.top };
    };
    const overCard = (e: PointerEvent) => e.target instanceof Element && e.target.closest("[data-hub-target]") !== null;

    const onMove = (e: PointerEvent) => {
      if (overCard(e)) {
        mouse = null;
        lastEmit = null;
        return;
      }
      const at = local(e);
      mouse = at;
      if (!lastEmit || Math.hypot(at.x - lastEmit.x, at.y - lastEmit.y) >= CELL * EMIT_EVERY_CELLS) {
        spawn(at.x, at.y, towardCard(at.x, at.y));
        lastEmit = at;
      }
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (overCard(e) || (e.target instanceof Element && e.target.closest("button, a, input"))) return;
      const at = local(e);
      for (let k = 0; k < 4; k++) spawn(at.x, at.y, k);
    };
    const onLeave = () => {
      mouse = null;
      lastEmit = null;
    };
    // Um pulso solto de vez em quando: nasce numa borda da tela e corre para o cartao.
    const ambient = window.setInterval(() => {
      if (document.hidden || pulses.length > 20) return;
      measureCard();
      const width = el.clientWidth;
      const height = el.clientHeight;
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? 0 : side === 2 ? width : Math.random() * width;
      const y = side === 1 ? 0 : side === 3 ? height : Math.random() * height;
      spawn(x, y, towardCard(x, y));
    }, AMBIENT_MS);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.clearInterval(ambient);
      cancelAnimationFrame(loop);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:44px_44px]" />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
