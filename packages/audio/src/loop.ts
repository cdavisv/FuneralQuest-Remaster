/**
 * Loop seam repair, run on decoded audio. A loop file is periodic before encoding (see the
 * render), but a lossy codec makes different errors at the loop's end and at its start, so the
 * jump from `end` back to `start` can land on a small step. Crossfading the last `fade` samples
 * before `end` into the samples just before `start` (the same music, coded a second time) makes
 * the sample at `end - 1` flow straight into the one at `start`.
 */
export function repairLoop(x: Float32Array, start: number, end: number, fade: number): void {
  const n = Math.min(fade, start, end - start);
  if (n <= 0 || end > x.length) return;
  for (let i = 0; i < n; i++) {
    // equal-gain: both segments carry the same signal, so their errors average, not their power
    const w = (i + 1) / n;
    const a = end - n + i;
    const b = start - n + i;
    x[a] = (x[a] as number) * (1 - w) + (x[b] as number) * w;
  }
}
