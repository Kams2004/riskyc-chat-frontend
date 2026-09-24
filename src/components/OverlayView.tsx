import type { StatusOverlay } from '../lib/overlay';

function pathFromPoints(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
}

/**
 * Composites drawing strokes + an optional text label on top of whatever's
 * rendered behind it — the parent must be `position: relative` and exactly
 * match the underlying image's rendered box, since strokes are stored as
 * fractional (0-1) coordinates of that box. Never baked into the image's
 * own pixels, same non-destructive convention as mobile's StatusOverlayView.
 */
export function OverlayView({ overlay }: { overlay: StatusOverlay }) {
  if (overlay.strokes.length === 0 && !overlay.text) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {overlay.strokes.map((s, i) => (
          <path
            key={i}
            d={pathFromPoints(s.points)}
            stroke={s.color}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {overlay.text && (
        <div
          style={{
            position: 'absolute',
            left: `${overlay.text.x * 100}%`,
            top: `${overlay.text.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            color: overlay.text.color,
            fontWeight: 700,
            fontSize: 18,
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          {overlay.text.text}
        </div>
      )}
    </div>
  );
}
