function formatCallDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * A call's outcome, logged inline in the thread like a real message — see
 * mobile's CallLogRow ([conversationId].tsx). ciphertext carries the
 * outcome (ENDED/MISSED/DECLINED) and mediaFileName the call type
 * (AUDIO/VIDEO), repurposed since neither has a dedicated column.
 */
export function CallLogRow({
  callType,
  outcome,
  durationMs,
  isMine,
  onCallBack,
}: {
  callType: string | null | undefined;
  outcome: string;
  durationMs: number | null | undefined;
  isMine: boolean;
  onCallBack?: () => void;
}) {
  const isVideo = callType === 'VIDEO';
  const missed = outcome === 'MISSED';
  const declined = outcome === 'DECLINED';

  let label = isVideo ? 'Video call' : 'Voice call';
  if (missed) label = isMine ? `${label} — no answer` : `Missed ${label.toLowerCase()}`;
  else if (declined) label = isMine ? `${label} — declined` : `Declined ${label.toLowerCase()}`;

  return (
    <button
      type="button"
      className={`call-log-pill ${missed || declined ? 'attention' : ''}`}
      onClick={onCallBack}
      disabled={!onCallBack}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isMine ? <path d="M7 17L17 7M17 7H9M17 7v8" /> : <path d="M17 7L7 17M7 17h8M7 17V9" />}
      </svg>
      <span>{label}</span>
      {!!durationMs && durationMs > 0 && <span className="call-log-duration">{formatCallDuration(durationMs)}</span>}
      {!!onCallBack && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.902.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.908.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      )}
    </button>
  );
}
