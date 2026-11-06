import { optimize } from "svgo";

/** SVGO with settings that keep the 550x400 viewBox and the exact geometry (2 decimals). */
export function optimizeSvg(svg: string): string {
  const res = optimize(svg, {
    multipass: true,
    floatPrecision: 2,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            // Keep ids stable and readable for gradients and clip paths.
            cleanupIds: { minify: false },
          },
        },
      },
    ],
  });
  return `${res.data}\n`;
}
