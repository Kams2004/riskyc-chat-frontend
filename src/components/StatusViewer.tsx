import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../features/auth/AuthContext';
import { useMediaUrl } from '../features/media/useMediaUrl';
import { sendStatusReply } from '../features/status/reply';
import { deleteStatus, fetchStatusViewers, markStatusViewed, type StatusItem, type ViewerRow } from '../features/status/api';

const IMAGE_DURATION_MS = 5000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Full-screen story-style viewer for one contact's (or my own) active
 * statuses — mirrors mobile's status/viewer.tsx: per-item progress bars,
 * click-left/right to step, image auto-advance at 5s / video on end,
 * poster-only viewed-by + delete, reply-to-status for others' updates.
 */
export function StatusViewer({
  initialStatuses,
  isOwn,
  onClose,
  onDeleted,
  onOpenReplyThread,
}: {
  initialStatuses: StatusItem[];
  isOwn: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onOpenReplyThread: (conversationId: string) => void;
}) {
  const { userId, accessToken } = useAuth();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<ViewerRow[] | null>(null);
  const [replyText, setReplyText] = useState('');
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const current = initialStatuses[index];
  const url = useMediaUrl(current?.mediaObjectKey ?? undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  function goNext() {
    if (index >= initialStatuses.length - 1) {
      onClose();
      return;
    }
    setIndex((i) => i + 1);
  }

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  useEffect(() => {
    setProgress(0);
    setViewers(null);
    if (!current) return;
    markStatusViewed(current.statusId).catch(() => {});
  }, [current?.statusId]);

  // Progress-bar animation — images advance on a fixed timer, videos track
  // their own currentTime/duration instead (started below via onTimeUpdate).
  useEffect(() => {
    if (!current || current.mediaType === 'VIDEO' || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now() - progress * IMAGE_DURATION_MS;
    function tick(now: number) {
      const ratio = Math.min(1, (now - startRef.current) / IMAGE_DURATION_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.statusId, paused]);

  useEffect(() => {
    if (current?.mediaType === 'VIDEO' && videoRef.current) {
      if (paused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  }, [paused, current?.statusId]);

  function loadViewers() {
    if (viewers !== null) {
      setViewers(null);
      return;
    }
    fetchStatusViewers(current.statusId)
      .then(setViewers)
      .catch(() => setViewers([]));
  }

  async function handleDelete() {
    if (!window.confirm('Delete this status update?')) return;
    await deleteStatus(current.statusId).catch(() => {});
    onDeleted();
    goNext();
  }

  async function handleReplySend() {
    if (!replyText.trim() || !userId) return;
    const text = replyText.trim();
    setReplyText('');
    const conversationId = [userId, current.userId].sort().join('_');
    await sendStatusReply(accessToken, userId, current, text).catch(() => {});
    onOpenReplyThread(conversationId);
  }

  if (!current) return null;

  return (
    <div className="status-viewer-backdrop">
      <div className="status-viewer">
        <div className="status-viewer-bars">
          {initialStatuses.map((s, i) => (
            <div key={s.statusId} className="status-viewer-bar">
              <div
                className="status-viewer-bar-fill"
                style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        <div className="status-viewer-header">
          <span className="status-viewer-time">{formatTime(current.createdAt)}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            {isOwn && (
              <button className="icon-button" title="Delete" onClick={handleDelete} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                🗑
              </button>
            )}
            <button className="icon-button" title="Close" onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              ✕
            </button>
          </div>
        </div>

        <div
          className="status-viewer-content"
          style={current.mediaType === 'TEXT' ? { backgroundColor: current.backgroundColor || '#e6004a' } : undefined}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
        >
          <div className="status-viewer-zone left" onClick={goPrev} />
          <div className="status-viewer-zone right" onClick={goNext} />

          {current.mediaType === 'TEXT' && <p className="status-viewer-text">{current.textContent}</p>}
          {current.mediaType === 'IMAGE' && url && <img src={url} alt="" className="status-viewer-media" />}
          {current.mediaType === 'VIDEO' && url && (
            <video ref={videoRef} src={url} className="status-viewer-media" autoPlay onEnded={goNext} />
          )}
          {current.mediaType !== 'TEXT' && !!current.textContent && <p className="status-viewer-caption">{current.textContent}</p>}
        </div>

        {isOwn ? (
          <button className="status-viewer-viewers-toggle" onClick={loadViewers}>
            {viewers === null ? 'Viewed by' : `Viewed by ${viewers.length}`}
            {viewers !== null && (
              <div className="status-viewer-viewers-list">
                {viewers.length === 0 && <span>No views yet</span>}
                {viewers.map((v) => (
                  <div key={v.viewerId}>{v.viewerId} · {formatTime(v.viewedAt)}</div>
                ))}
              </div>
            )}
          </button>
        ) : (
          <div className="status-viewer-reply-row">
            <input
              className="composer-input"
              placeholder="Reply"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReplySend();
              }}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
            />
            <button className="composer-send" onClick={handleReplySend} disabled={!replyText.trim()}>
              ➤
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
