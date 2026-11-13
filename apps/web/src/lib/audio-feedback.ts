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

/**
 * Um tocador de audio so para o app (13/11/2026). O Safari so deixa tocar um
 * AudioContext que foi ligado num toque ou clique: o criado depois, fora de um
 * gesto (o sino, que toca quando chega item novo), nascia pausado e ficava
 * mudo. Agora o tocador e criado e liberado no primeiro toque/tecla da pagina
 * (`installAudioUnlock`) e reaproveitado por todos os sons.
 */
let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new AudioCtx();
  return sharedContext;
}

let unlockInstalled = false;

/** Libera o tocador no primeiro toque, clique ou tecla da pagina (uma vez; depois some). */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = () => {
    const ctx = audioContext();
    if (!ctx) return;
    void ctx
      .resume()
      .then(() => {
        if (ctx.state !== "running") return;
        for (const name of events) window.removeEventListener(name, unlock, true);
      })
      .catch(() => {});
    // iOS: um som mudo dentro do gesto termina de liberar o audio.
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // sem audio: segue sem som
    }
  };
  for (const name of events) window.addEventListener(name, unlock, { capture: true, passive: true });
}

/**
 * Toca as notas no tocador compartilhado. `requireRunning`: som que nao vem de
 * um clique (o sino) so toca se o tocador ja esta liberado; senao ficaria na
 * fila e soaria fora de hora no proximo toque.
 */
function playTones(tones: Tone[], options: { requireRunning?: boolean } = {}) {
  const ctx = audioContext();
  if (!ctx) return;
  const schedule = () => {
    const now = ctx.currentTime;
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
    }
  };
  if (ctx.state === "running") {
    schedule();
    return;
  }
  if (options.requireRunning) return;
  // Dentro de um clique (presenca, Testar): liga o tocador e toca.
  void ctx
    .resume()
    .then(() => {
      if (ctx.state === "running") schedule();
    })
    .catch(() => {});
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


/** Duracao de cada balanco do sino no pulsar (`bell-pulse` em globals.css: 3 x 0,9 s). */
const BELL_SWING_SECONDS = 0.9;

/**
 * Sino de lembrete novo (12/11/2026): uma batida em cada balanco do icone, no
 * ponto mais alto (20% do balanco), cada vez mais fraca, como um sino que para
 * de tocar. Timbre de sino pequeno: a nota e dois parciais agudos que somem antes.
 */
export function playBellChime(options: { fromClick?: boolean } = {}) {
  if (typeof window === "undefined") return;
  try {
    playTones(
      [0.09, 0.055, 0.03].flatMap((volume, i): Tone[] => {
        const at = BELL_SWING_SECONDS * (0.2 + i);
        return [
          { wave: "sine", from: 1174.66, at, duration: 0.85, volume },
          { wave: "sine", from: 3242, at, duration: 0.3, volume: volume * 0.35 },
          { wave: "sine", from: 6343, at, duration: 0.12, volume: volume * 0.12 },
        ];
      }),
      { requireRunning: !options.fromClick },
    );
  } catch {
    // sem audio (navegador antigo ou sem toque na pagina ainda): so o pulsar
  }
}

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
