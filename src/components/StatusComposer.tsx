import { faCamera, faFont, faPaperPlane, faPlay, faPause, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';
import { trimVideo, uploadMedia } from '../features/media/api';
import { createStatus, type StatusMediaType } from '../features/status/api';

/** Same 8 presets as mobile's status/new.tsx (BACKGROUND_PRESETS). */
const BACKGROUND_PRESETS = ['#e6004a', '#075e54', '#128c7e', '#25d366', '#34495e', '#8e44ad', '#d35400', '#2c3e50'];

/** Matches mobile's MAX_STATUS_VIDEO_MS — the trim window can never be wider than this, same 30s cap as the status video trimmer. */
const MAX_VIDEO_MS = 30_000;

type PendingMedia = { file: File; type: 'IMAGE' | 'VIDEO'; previewUrl: string };

function readVideoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration * 1000);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not read video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Dual-handle trim bar over the video's full duration — a plain track
 * (no filmstrip thumbnails; a deliberate, flagged scope reduction from
 * mobile's VideoTrimmer, whose thumbnail extraction is a separate,
 * substantial build-out) with two draggable handles clamped to a
 * MAX_VIDEO_MS-wide window. Dragging updates trimStart/trimEnd in ms.
 */
function TrimBar({
  durationMs,
  trimStart,
  trimEnd,
  onChange,
}: {
  durationMs: number;
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  function msFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * durationMs;
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const ms = msFromClientX(e.clientX);
      if (draggingRef.current === 'start') {
        const next = Math.min(ms, trimEnd - 500);
        onChange(Math.max(0, next), trimEnd);
      } else {
        const next = Math.max(ms, trimStart + 500);
        onChange(trimStart, Math.min(durationMs, next, trimStart + MAX_VIDEO_MS));
      }
    }
    function onUp() {
      draggingRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, trimStart, trimEnd]);

  const startPct = durationMs > 0 ? (trimStart / durationMs) * 100 : 0;
  const endPct = durationMs > 0 ? (trimEnd / durationMs) * 100 : 100;

  return (
    <div className="status-trim-bar" ref={trackRef}>
      <div className="status-trim-dim" style={{ left: 0, width: `${startPct}%` }} />
      <div className="status-trim-dim" style={{ left: `${endPct}%`, right: 0, width: 'auto' }} />
      <div className="status-trim-selection" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
      <div
        className="status-trim-handle"
        style={{ left: `${startPct}%` }}
        onPointerDown={() => (draggingRef.current = 'start')}
      />
      <div
        className="status-trim-handle"
        style={{ left: `${endPct}%` }}
        onPointerDown={() => (draggingRef.current = 'end')}
      />
    </div>
  );
}

/**
 * Text and image/video status composer. Scope cut vs. mobile (flagged in
 * joyful-tinkering-owl.md Phase 2): no freehand-drawing/text-overlay
 * compositing, and the trim bar is a plain track without filmstrip
 * thumbnails — the trim itself (cutting the clip down before posting) is
 * fully implemented, same server-side ffmpeg stream-copy endpoint mobile's
 * trimmer uses.
 */
export function StatusComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [mode, setMode] = useState<'pick' | 'text' | 'media'>('pick');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BACKGROUND_PRESETS[0]);
  const [media, setMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type: 'IMAGE' | 'VIDEO' = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    const previewUrl = URL.createObjectURL(file);
    if (type === 'VIDEO') {
      try {
        const durationMs = await readVideoDurationMs(file);
        setVideoDurationMs(durationMs);
        setTrimStart(0);
        setTrimEnd(Math.min(durationMs, MAX_VIDEO_MS));
      } catch {
        setVideoDurationMs(0);
      }
    }
    setMedia({ file, type, previewUrl });
    setMode('media');
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime * 1000 >= trimEnd || video.currentTime * 1000 < trimStart) {
        video.currentTime = trimStart / 1000;
      }
      video.play().catch(() => {});
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime * 1000 >= trimEnd) {
      video.pause();
      video.currentTime = trimStart / 1000;
    }
  }

  async function postText() {
    if (!text.trim()) return;
    setIsPosting(true);
    try {
      await createStatus({ mediaType: 'TEXT', textContent: text.trim(), backgroundColor: bgColor });
      onPosted();
    } catch {
      window.alert('Could not post your status — please try again.');
    } finally {
      setIsPosting(false);
    }
  }

  async function postMedia() {
    if (!media) return;
    setIsPosting(true);
    try {
      let objectKey = await uploadMedia(media.file);
      // Only actually cuts the clip when the selection isn't the whole
      // thing — a short video the user never touched the handles on
      // shouldn't cost an extra server round trip.
      if (media.type === 'VIDEO' && videoDurationMs > 0 && (trimStart > 0 || trimEnd < videoDurationMs)) {
        const trimmed = await trimVideo(objectKey, trimStart, trimEnd);
        objectKey = trimmed.objectKey;
      }
      await createStatus({ mediaType: media.type as StatusMediaType, mediaObjectKey: objectKey, textContent: caption.trim() || null });
      onPosted();
    } catch {
      window.alert('Could not post your status — please try again.');
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="status-composer" onClick={(e) => e.stopPropagation()}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFilePicked} />

        {mode === 'pick' && (
          <div className="status-composer-pick">
            <h3>New status update</h3>
            <button className="link-button" onClick={() => fileInputRef.current?.click()}>
              <Icon icon={faCamera} /> Photo or video
            </button>
            <button className="link-button secondary" onClick={() => setMode('text')}>
              <Icon icon={faFont} /> Text status
            </button>
            <button className="link-button secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'text' && (
          <div className="status-text-editor" style={{ backgroundColor: bgColor }}>
            <button className="icon-button status-composer-close" onClick={onClose} title="Close">
              <Icon icon={faXmark} />
            </button>
            <textarea
              className="status-text-input"
              placeholder="Type a status"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              maxLength={700}
            />
            <div className="status-bg-swatches">
              {BACKGROUND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`status-bg-swatch ${bgColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setBgColor(c)}
                />
              ))}
            </div>
            <button className="composer-send status-composer-send" onClick={postText} disabled={!text.trim() || isPosting}>
              {isPosting ? '…' : <Icon icon={faPaperPlane} />}
            </button>
          </div>
        )}

        {mode === 'media' && media && (
          <div className="status-media-editor">
            <button className="icon-button status-composer-close" onClick={onClose} title="Close">
              <Icon icon={faXmark} />
            </button>
            {media.type === 'IMAGE' ? (
              <img src={media.previewUrl} alt="" className="status-media-preview" />
            ) : (
              <div className="status-video-trim-wrap">
                <div className="status-media-preview status-video-preview-frame">
                  <video
                    ref={videoRef}
                    src={media.previewUrl}
                    className="status-video-preview"
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    playsInline
                  />
                  <button type="button" className="status-video-play-button" onClick={togglePlay}>
                    <Icon icon={isPlaying ? faPause : faPlay} />
                  </button>
                </div>
                {videoDurationMs > 0 && (
                  <>
                    <TrimBar
                      durationMs={videoDurationMs}
                      trimStart={trimStart}
                      trimEnd={trimEnd}
                      onChange={(s, e) => {
                        setTrimStart(s);
                        setTrimEnd(e);
                      }}
                    />
                    <div className="status-trim-label">{formatSeconds((trimEnd - trimStart) / 1000)} selected (max 0:30)</div>
                  </>
                )}
              </div>
            )}
            <div className="status-media-caption-row">
              <input
                className="composer-input"
                placeholder="Add a caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <button className="composer-send" onClick={postMedia} disabled={isPosting}>
                {isPosting ? '…' : <Icon icon={faPaperPlane} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
