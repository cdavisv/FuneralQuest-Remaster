export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function pathBox(d: string): Box | null;
export function boxInside(inner: Box, outer: Box, slack?: number): boolean;
export function stripText(svg: string): string;
export function countText(svg: string): number;
export function listPaths(svg: string): {
  markup: string;
  index: number;
  fill: string;
  stroke: string;
  box: Box | null;
}[];
export function removePathsInside(
  svg: string,
  boxes: Box[],
  slack?: number,
  unfilledOnly?: boolean,
): { svg: string; removed: number };
export function setViewBox(svg: string, viewBox: [number, number, number, number]): string;
export function extractImage(svg: string, id: string): string;
export function stretch(svg: string): string;
export function stripTitle(svg: string): string;
export function numbers(s: string): number[];
export function deriveUiSvg(
  svg: string,
  recipe?: {
    stripText?: boolean;
    removeInside?: Box[];
    removeCaptionsInside?: Box[];
    stretch?: boolean;
    extractImage?: string;
    viewBox?: [number, number, number, number];
  },
): { svg: string; report: { textRemoved: number; pathsRemoved: number } };
