import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TYPEWRITER_CPS, type TypewriterSpeed } from "../settings/settings.js";

export interface Typewriter {
  /** How many characters to show. */
  shown: number;
  /** True while characters are still being revealed. */
  typing: boolean;
  /** Reveal everything now. */
  skip: () => void;
}

/**
 * Reveals `total` characters over time, restarting whenever `resetKey` changes.
 * With speed "off" everything shows at once. Clicking (or pressing Enter) calls `skip`.
 */
export function useTypewriter(total: number, resetKey: string, speed: TypewriterSpeed): Typewriter {
  const [shown, setShown] = useState(speed === "off" ? total : 0);
  const stop = useRef<(() => void) | null>(null);

  // Layout effect so a new text never flashes in full before it starts typing.
  useLayoutEffect(() => {
    stop.current?.();
    stop.current = null;
    // `resetKey` restarts the reveal even when the length is unchanged.
    void resetKey;
    if (speed === "off" || total === 0) {
      setShown(total);
      return;
    }
    setShown(0);
    const cps = TYPEWRITER_CPS[speed];
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(total, Math.floor(((now - start) / 1000) * cps));
      setShown(n);
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    stop.current = () => cancelAnimationFrame(raf);
    return () => cancelAnimationFrame(raf);
  }, [resetKey, total, speed]);

  useEffect(() => () => stop.current?.(), []);

  const skip = useCallback(() => {
    stop.current?.();
    stop.current = null;
    setShown(total);
  }, [total]);

  return { shown, typing: shown < total, skip };
}
