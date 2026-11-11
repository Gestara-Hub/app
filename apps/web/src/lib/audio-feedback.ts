import type { CheckinSound } from "@gestarahub/contracts";

/**
 * Síntese de áudio leve via Web Audio API para feedback sonoro (presença, check-in, etc.)
 * Sem necessidade de arquivos de áudio externos.
 */

/** Nome de cada som da chamada na tela de Preferências. */
export const CHECKIN_SOUND_LABELS: Record<CheckinSound, string> = {
  confirm: "Confirmação",
  beep: "Bipe",
  bell: "Sino",
  drop: "Gota",
  chord: "Acorde",
  marimba: "Marimba",
  soft: "Suave",
};

interface Tone {
  wave: OscillatorType;
  /** Frequência no início e no fim (Hz); iguais = nota parada. */
  from: number;
  to?: number;
  /** Início e duração em segundos, a partir de agora. */
  at?: number;
  duration: number;
  volume: number;
}

function playTones(tones: Tone[]) {
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;
  let end = 0;
  for (const tone of tones) {
    const start = now + (tone.at ?? 0);
    const stop = start + tone.duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.from, start);
    if (tone.to && tone.to !== tone.from) osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.duration * 0.5);
    gain.gain.setValueAtTime(tone.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, stop);
    osc.start(start);
    osc.stop(stop);
    end = Math.max(end, (tone.at ?? 0) + tone.duration);
  }
  setTimeout(() => {
    ctx.close().catch(() => {});
  }, end * 1000 + 150);
}

const CHECKIN_TONES: Record<CheckinSound, Tone[]> = {
  // Padrao: duas notas rapidas subindo, o "deu certo" que todo mundo reconhece.
  confirm: [
    { wave: "triangle", from: 987.77, duration: 0.07, volume: 0.1 },
    { wave: "triangle", from: 1318.5, at: 0.07, duration: 0.25, volume: 0.1 },
  ],
  // Tom duplo agradável (ascendente): o som de antes de 09/11/2026.
  beep: [{ wave: "sine", from: 587.33, to: 880, duration: 0.25, volume: 0.12 }],
  // Nota aguda com cauda longa e um harmônico, como um sino pequeno.
  bell: [
    { wave: "sine", from: 1318.5, duration: 0.7, volume: 0.1 },
    { wave: "sine", from: 2637, duration: 0.35, volume: 0.03 },
  ],
  // Queda rápida de altura, como uma gota.
  drop: [{ wave: "sine", from: 1200, to: 380, duration: 0.18, volume: 0.14 }],
  // Três notas subindo em sequência (dó, mi, sol).
  chord: [
    { wave: "sine", from: 523.25, duration: 0.18, volume: 0.1 },
    { wave: "sine", from: 659.25, at: 0.07, duration: 0.18, volume: 0.1 },
    { wave: "sine", from: 783.99, at: 0.14, duration: 0.28, volume: 0.1 },
  ],
  // Nota média com som de madeira: fundamental e um harmônico curto.
  marimba: [
    { wave: "sine", from: 698.46, duration: 0.35, volume: 0.13 },
    { wave: "sine", from: 2794, duration: 0.06, volume: 0.04 },
  ],
  // Nota grave e baixinha, para ambiente silencioso.
  soft: [{ wave: "sine", from: 440, duration: 0.3, volume: 0.07 }],
};


export function playAudioFeedback(
  type: "success" | "checkin" | "error" = "checkin",
  sound: CheckinSound = "confirm",
) {
  if (typeof window === "undefined") return;
  try {
    if (type === "error") {
      // Tom baixo de aviso
      playTones([{ wave: "triangle", from: 220, duration: 0.3, volume: 0.15 }]);
      return;
    }
    playTones(CHECKIN_TONES[sound] ?? CHECKIN_TONES.confirm);
  } catch {
    // ignore audio context failures
  }
}
