import { useEffect, useRef, useState } from 'react';

import { useMediaUrl } from '../features/media/useMediaUrl';
import type { AttachmentItem } from '../features/messaging/api';

function VideoPage({ objectKey }: { objectKey: string }) {
  const url = useMediaUrl(objectKey);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  if (!url) return <div style={{ width: '100%', height: '100%', background: '#111' }} />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video
        ref={videoRef}
        src={url}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={toggle}
      />
      <button
        onClick={toggle}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width={26} height={26} viewBox="0 0 24 24" fill="#fff">
          {isPlaying ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
    </div>
  );
}

function ImagePage({ objectKey }: { objectKey: string }) {
  const url = useMediaUrl(objectKey);
  if (!url) return <div style={{ width: '100%', height: '100%', background: '#111' }} />;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.4)',
  border: 'none',
  color: '#fff',
  fontSize: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 5,
};

/** Full-screen viewer with prev/next buttons — the web equivalent of mobile's swipeable MediaViewer. */
export function MediaViewer({ items, initialIndex, onClose }: { items: AttachmentItem[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose]);

  if (items.length === 0) return null;
  const item = items[index];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <button onClick={onClose} style={{ ...navButtonStyle, top: 16, left: 16, transform: 'none' }}>
        ✕
      </button>

      {items.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 13,
          }}
        >
          {index + 1} / {items.length}
        </div>
      )}

      {index > 0 && (
        <button onClick={() => setIndex(index - 1)} style={{ ...navButtonStyle, left: 16 }}>
          ‹
        </button>
      )}
      {index < items.length - 1 && (
        <button onClick={() => setIndex(index + 1)} style={{ ...navButtonStyle, right: 16 }}>
          ›
        </button>
      )}

      <div style={{ width: '90%', height: '85%' }}>
        {item.mediaType === 'VIDEO' ? <VideoPage objectKey={item.mediaObjectKey} /> : <ImagePage objectKey={item.mediaObjectKey} />}
      </div>
    </div>
  );
}
