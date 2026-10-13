import { useEffect, useState } from 'react';

type ProgressBarProps = {
  /** Shows and starts climbing while true; resets to 0% and hides the instant it flips to false. */
  active: boolean;
  label?: string;
};

/**
 * Simulated determinate progress for short request/response flows (OTP
 * verify, device pairing) that have no real byte-level signal to drive a
 * true percentage — climbs on an easing curve toward 90% while `active`,
 * then the caller flips `active` to false right as the real operation
 * resolves. Same idea/math as TabLockGate's own progress bar, kept as a
 * separate component here rather than reused there since TabLockGate needs
 * finer control (an explicit 100%-then-hold step before swapping views).
 */
export function ProgressBar({ active, label }: ProgressBarProps) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!active) {
      setPercent(0);
      return;
    }
    setPercent(8);
    const interval = setInterval(() => {
      setPercent((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
    }, 120);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const rounded = Math.round(percent);

  return (
    <div className="progress-bar-wrap">
      {label && <span className="progress-bar-label">{label}</span>}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${rounded}%` }} />
      </div>
      <span className="progress-bar-percent">{rounded}%</span>
    </div>
  );
}
