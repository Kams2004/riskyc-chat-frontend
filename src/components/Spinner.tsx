/**
 * Circular dotted loader (8 dots fading in sequence around a ring),
 * replacing the plain "Loading…" text used throughout the app. Takes an
 * explicit pixel size so call sites can size it to their own context (a
 * small inline spinner next to a row vs. a large centered one on an empty
 * screen) — the dot positions are computed from that size, not baked into
 * fixed CSS, which is what makes it responsive to whatever size is passed.
 */
export function Spinner({ size = 28 }: { size?: number }) {
  const dotSize = Math.max(2, size / 8);
  const radius = size / 2 - dotSize / 2;
  return (
    <div className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="spinner-dot"
          style={{
            width: dotSize,
            height: dotSize,
            marginLeft: -dotSize / 2,
            marginTop: -dotSize / 2,
            transform: `rotate(${i * 45}deg) translateY(-${radius}px)`,
            animationDelay: `${i * 0.125}s`,
          }}
        />
      ))}
    </div>
  );
}
