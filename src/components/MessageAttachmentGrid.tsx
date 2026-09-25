import { faDownload, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { useMediaUrlWithStatus } from '../features/media/useMediaUrl';
import { useInView } from '../lib/useInView';
import { parseOverlay } from '../lib/overlay';
import type { AttachmentItem } from '../features/messaging/api';
import { Icon } from './Icon';
import { OverlayView } from './OverlayView';
import { Spinner } from './Spinner';

// A percentage-of-container width rather than a fixed pixel value — the
// container itself is capped at `min(260px, 100%)` (see the wrapping div
// below), so this whole grid scales down instead of overflowing a narrow
// phone-width browser viewport (a real, unverified-safe overflow risk when
// this used a hardcoded 260px regardless of viewport).
const GAP_PERCENT = 1.5;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Tile({ item, widthPercent, onClick, overlay }: { item: AttachmentItem; widthPercent: number; onClick: () => void; overlay?: React.ReactNode }) {
  // Off-screen tiles in a long scrolled thread shouldn't each mint a
  // presigned download URL and pull their image the moment the thread
  // mounts — resolution is gated behind actually entering the viewport
  // (see useInView; a 200px rootMargin pre-warms just before it's visible).
  const { ref, inView } = useInView<HTMLDivElement>();
  const { url, status, retry } = useMediaUrlWithStatus(inView ? item.mediaObjectKey : null);
  // The hook only tracks presigned-URL resolution — the actual image byte
  // fetch can still fail separately (network blip, expired-by-the-time-it-
  // loads URL, ...), which onError below catches into this same error UI.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [url]);
  const effectiveStatus = imgFailed ? 'error' : status;

  function handleRetry() {
    setImgFailed(false);
    retry();
  }

  return (
    <div
      ref={ref}
      onClick={effectiveStatus === 'error' ? undefined : onClick}
      style={{
        width: `${widthPercent}%`,
        aspectRatio: '1',
        position: 'relative',
        cursor: effectiveStatus === 'error' ? 'default' : 'pointer',
        background: 'rgba(0,0,0,0.08)',
      }}
    >
      {status === 'ready' && url && !imgFailed && (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      )}
      {status === 'ready' && !imgFailed && item.overlayJson && <OverlayView overlay={parseOverlay(item.overlayJson)!} />}
      {effectiveStatus === 'loading' && inView && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={28} />
        </div>
      )}
      {effectiveStatus === 'error' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRetry();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            border: 'none',
            background: 'rgba(0,0,0,0.05)',
            color: 'var(--brand-600)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Icon icon={faRotateRight} style={{ fontSize: 18 }} />
          Retry
        </button>
      )}
      {effectiveStatus === 'ready' && item.mediaType === 'VIDEO' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      {overlay}
    </div>
  );
}

function GridBody({ items, onOpen }: { items: AttachmentItem[]; onOpen: (index: number) => void }) {
  const containerStyle: React.CSSProperties = { width: 'min(260px, 100%)', borderRadius: 12, overflow: 'hidden' };

  if (items.length === 1) {
    return (
      <div style={containerStyle}>
        <Tile item={items[0]} widthPercent={100} onClick={() => onOpen(0)} />
      </div>
    );
  }

  if (items.length <= 3) {
    const halfWidth = 50 - GAP_PERCENT / 2;
    return (
      <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', gap: `${GAP_PERCENT}%` }}>
        {items.map((item, i) => (
          <Tile key={i} item={item} widthPercent={items.length === 3 && i === 2 ? 100 : halfWidth} onClick={() => onOpen(i)} />
        ))}
      </div>
    );
  }

  const halfWidth = 50 - GAP_PERCENT / 2;
  const remaining = items.length - 4;
  return (
    <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', gap: `${GAP_PERCENT}%` }}>
      {items.slice(0, 4).map((item, i) => (
        <Tile
          key={i}
          item={item}
          widthPercent={halfWidth}
          onClick={() => onOpen(i)}
          overlay={
            i === 3 && remaining > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(41,0,15,0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                +{remaining}
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * WhatsApp-style collage — same layout rules as mobile's MessageAttachmentGrid,
 * sized as percentages of a capped-but-fluid container so it can't overflow a
 * narrow viewport. With auto-download on (the default), a single item still
 * auto-loads and 2+ items (a real gallery send) stay behind a download gate
 * showing the combined size and item count until explicitly tapped, instead
 * of every tile silently fetching the moment it scrolls into view — a single
 * item was never batched this way, matching how a lone photo isn't merged
 * with an unrelated one sent separately. With autoDownloadMedia off (see
 * ConversationController#setAutoDownload backend-side, set from group/chat
 * details), that gate applies to every item, single or not.
 */
export function MessageAttachmentGrid({
  items,
  onOpen,
  autoDownloadMedia = true,
}: {
  items: AttachmentItem[];
  onOpen: (index: number) => void;
  autoDownloadMedia?: boolean;
}) {
  const [revealed, setRevealed] = useState(autoDownloadMedia && items.length <= 1);

  if (items.length === 0) return null;
  if (revealed) return <GridBody items={items} onOpen={onOpen} />;

  const totalBytes = items.reduce((sum, i) => sum + (i.mediaFileSize ?? 0), 0);
  const knownSize = items.every((i) => typeof i.mediaFileSize === 'number');
  const label = items[0].mediaType === 'VIDEO' && items.every((i) => i.mediaType === 'VIDEO')
    ? `${items.length} videos`
    : items.every((i) => i.mediaType === 'IMAGE')
      ? `${items.length} photos`
      : `${items.length} items`;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      style={{
        width: 'min(260px, 100%)',
        aspectRatio: '1',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          borderRadius: 999,
          padding: '10px 18px',
        }}
      >
        <Icon icon={faDownload} style={{ fontSize: 16 }} />
        <div style={{ textAlign: 'left' }}>
          {knownSize && totalBytes > 0 && <div style={{ fontWeight: 700, fontSize: 13 }}>{formatBytes(totalBytes)}</div>}
          <div style={{ fontSize: 12, opacity: 0.85 }}>{label}</div>
        </div>
      </div>
    </button>
  );
}
