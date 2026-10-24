import { useCallback, useEffect, useState } from "react";

/** Contagem regressiva em segundos (ex.: "Reenviar em 45 s"). `start(n)` recomeca. */
export function useCountdown(): { seconds: number; start: (seconds: number) => void } {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) setEndsAt(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((next: number) => setEndsAt(Date.now() + next * 1000), []);
  return { seconds, start };
}
