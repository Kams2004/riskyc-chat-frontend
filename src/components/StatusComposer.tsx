import { useRef, useState } from 'react';

import { uploadMedia } from '../features/media/api';
import { createStatus, type StatusMediaType } from '../features/status/api';

/** Same 8 presets as mobile's status/new.tsx (BACKGROUND_PRESETS). */
const BACKGROUND_PRESETS = ['#e6004a', '#075e54', '#128c7e', '#25d366', '#34495e', '#8e44ad', '#d35400', '#2c3e50'];

/** Matches mobile's MAX_STATUS_VIDEO_MS (30s cap, same as the status video trimmer). */
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

/**
 * Text and image/video status composer. Scope cut from mobile's version
 * (flagged in joyful-tinkering-owl.md Phase 2): no freehand-drawing/text-
 * overlay compositing, and no in-browser video trim UI — a video over the
 * 30s cap is rejected rather than trimmed, since mobile's VideoTrimmer is
 * React-Native-only and a web equivalent is its own separate build-out.
 */
export function StatusComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [mode, setMode] = useState<'pick' | 'text' | 'media'>('pick');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BACKGROUND_PRESETS[0]);
  const [media, setMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type: 'IMAGE' | 'VIDEO' = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    if (type === 'VIDEO') {
      try {
        const durationMs = await readVideoDurationMs(file);
        if (durationMs > MAX_VIDEO_MS) {
          window.alert('Status videos can be at most 30 seconds — please trim it before uploading.');
          return;
        }
      } catch {
        // Metadata read failed — let it through, the server's own limits still apply.
      }
    }
    setMedia({ file, type, previewUrl: URL.createObjectURL(file) });
    setMode('media');
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
      const objectKey = await uploadMedia(media.file);
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
              📷 Photo or video
            </button>
            <button className="link-button secondary" onClick={() => setMode('text')}>
              Aa Text status
            </button>
            <button className="link-button secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'text' && (
          <div className="status-text-editor" style={{ backgroundColor: bgColor }}>
            <button className="icon-button status-composer-close" onClick={onClose} title="Close">
              ✕
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
              {isPosting ? '…' : '➤'}
            </button>
          </div>
        )}

        {mode === 'media' && media && (
          <div className="status-media-editor">
            <button className="icon-button status-composer-close" onClick={onClose} title="Close">
              ✕
            </button>
            {media.type === 'IMAGE' ? (
              <img src={media.previewUrl} alt="" className="status-media-preview" />
            ) : (
              <video src={media.previewUrl} className="status-media-preview" controls />
            )}
            <div className="status-media-caption-row">
              <input
                className="composer-input"
                placeholder="Add a caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <button className="composer-send" onClick={postMedia} disabled={isPosting}>
                {isPosting ? '…' : '➤'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
