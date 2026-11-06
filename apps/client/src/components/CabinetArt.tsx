/** The carved walnut cabinet drawn as inline SVG, so it stays crisp at any size. */
export function CabinetArt({ width, height }: { width: number; height: number }) {
  const side = 34;
  const sideTop = 84;
  const peak = 26;
  const control = 2 * peak - sideTop;
  const bottom = height - 20;
  const outer = `M${side} ${sideTop} Q${width / 2} ${control} ${width - side} ${sideTop} L${width - side} ${bottom - 16} Q${width - side} ${bottom} ${width - side - 16} ${bottom} L${side + 16} ${bottom} Q${side} ${bottom} ${side} ${bottom - 16} Z`;
  const inset = (n: number) =>
    `M${side + n} ${sideTop + n * 0.4} Q${width / 2} ${control + n * 1.6} ${width - side - n} ${sideTop + n * 0.4} L${width - side - n} ${bottom - 16 - n * 0.3} Q${width - side - n} ${bottom - n} ${width - side - n - 14} ${bottom - n} L${side + n + 14} ${bottom - n} Q${side + n} ${bottom - n} ${side + n} ${bottom - 16 - n * 0.3} Z`;
  return (
    <svg
      className="fq-cabinet-art"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fq-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d2a972" />
          <stop offset="0.04" stopColor="#8a5a22" />
          <stop offset="0.35" stopColor="#3f1d01" />
          <stop offset="1" stopColor="#301501" />
        </linearGradient>
        <linearGradient id="fq-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4a06c" />
          <stop offset="0.3" stopColor="#a98351" />
          <stop offset="0.7" stopColor="#8a6630" />
          <stop offset="1" stopColor="#70501f" />
        </linearGradient>
        <radialGradient id="fq-glow" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#d9b681" stopOpacity="0.5" />
          <stop offset="1" stopColor="#d9b681" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fq-bevel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2bf8a" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#8a6a38" stopOpacity="0.2" />
          <stop offset="1" stopColor="#1b0b00" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d={outer} fill="url(#fq-rim)" />
      <path d={inset(15)} fill="url(#fq-body)" />
      <path d={inset(15)} fill="url(#fq-glow)" />
      <path d={inset(15)} fill="none" stroke="url(#fq-bevel)" strokeWidth="3" />
      <path d={inset(26)} fill="none" stroke="#6a4a1c" strokeOpacity="0.55" strokeWidth="2" />
    </svg>
  );
}
