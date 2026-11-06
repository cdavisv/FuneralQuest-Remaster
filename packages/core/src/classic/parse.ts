/**
 * C `atoi`/`atol` on text a player typed: optional spaces and sign, then
 * digits; anything else gives 0. Saturates at the 32-bit limits, as the
 * runtime's `strtol` does.
 */
export function atoi(text: string): number {
  const m = /^\s*([+-]?\d+)/.exec(text);
  if (!m) return 0;
  const value = Number.parseInt(m[1] as string, 10);
  return Math.max(-2147483648, Math.min(2147483647, value));
}
