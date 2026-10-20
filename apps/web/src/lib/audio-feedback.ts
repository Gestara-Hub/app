/**
 * Síntese de áudio leve via Web Audio API para feedback sonoro (presença, check-in, etc.)
 * Sem necessidade de arquivos de áudio externos.
 */

export function playAudioFeedback(type: "success" | "checkin" | "error" = "checkin") {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "checkin" || type === "success") {
      // Tom duplo agradável (ascendente)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Tom baixo de aviso
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // ignore audio context failures
  }
}
