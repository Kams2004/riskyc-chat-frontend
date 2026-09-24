/**
 * Same JSON shape as mobile's StatusOverlayView.ts (fractional 0-1
 * coordinates, so a stroke drawn on one platform renders correctly at any
 * size on the other) — an opaque, unparsed-server-side blob stored on
 * Message.overlayJson, mirroring how StatusPost already stores one.
 */
export type OverlayPoint = { x: number; y: number };
export type DrawStroke = { color: string; points: OverlayPoint[] };
export type TextLabel = { text: string; color: string; x: number; y: number };
export type StatusOverlay = { strokes: DrawStroke[]; text: TextLabel | null };

export const EMPTY_OVERLAY: StatusOverlay = { strokes: [], text: null };

export function isOverlayEmpty(overlay: StatusOverlay): boolean {
  return overlay.strokes.length === 0 && !overlay.text;
}

export function serializeOverlay(overlay: StatusOverlay): string | null {
  return isOverlayEmpty(overlay) ? null : JSON.stringify(overlay);
}

export function parseOverlay(json: string | null | undefined): StatusOverlay | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StatusOverlay;
  } catch {
    return null;
  }
}
