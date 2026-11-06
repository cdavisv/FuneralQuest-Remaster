import { useEffect, useRef, useState } from "react";

/**
 * The change a number just went through, for a moment: +100 when money rose, -50 when it fell,
 * null when nothing moved or the moment is over. Display only; the server's number is the truth.
 */
export function useDelta(value: number | undefined, ms = 2600): number | null {
  const last = useRef<number | undefined>(value);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = value;
    if (before === undefined || value === undefined || before === value) return;
    setDelta(value - before);
    const id = setTimeout(() => setDelta(null), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return delta;
}
