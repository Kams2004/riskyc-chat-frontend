import { faPaperPlane, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { Icon } from './Icon';
import { Spinner } from './Spinner';

export type PendingGalleryFile = { file: File; type: 'IMAGE' | 'VIDEO' };

type GalleryCaptionComposerProps = {
  items: PendingGalleryFile[] | null;
  onCancel: () => void;
  onSend: (caption: string) => Promise<boolean>;
};

/** Same idea as MediaCaptionComposer but for a multi-image/video send — a large preview of whichever thumbnail is selected, plus a row of thumbnails to switch between them, since there's no room to show every item large at once. Mirrors mobile's GalleryCaptionComposer. */
export function GalleryCaptionComposer({ items, onCancel, onSend }: GalleryCaptionComposerProps) {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);

  useEffect(() => {
    setCaption('');
    setActiveIndex(0);
    if (!items || items.length === 0) {
      setObjectUrls([]);
      return;
    }
    const urls = items.map((item) => URL.createObjectURL(item.file));
    setObjectUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [items]);

  if (!items || items.length === 0) return null;
  const active = items[Math.min(activeIndex, items.length - 1)];
  const activeUrl = objectUrls[Math.min(activeIndex, objectUrls.length - 1)];

  async function handleSend() {
    if (isSending) return;
    setIsSending(true);
    try {
      const succeeded = await onSend(caption);
      if (succeeded) setCaption('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="status-composer" onClick={(e) => e.stopPropagation()}>
        <div className="media-caption-editor">
          <button type="button" className="icon-button status-composer-close" onClick={onCancel} title="Cancel">
            <Icon icon={faXmark} />
          </button>

          <div className="media-caption-preview-wrap">
            {active.type === 'IMAGE' ? (
              <img src={activeUrl} alt="" className="media-caption-preview-media" />
            ) : (
              <video src={activeUrl} controls playsInline className="media-caption-preview-media" />
            )}
          </div>

          <div className="gallery-caption-thumb-row">
            {items.map((item, i) => (
              <button
                type="button"
                key={i}
                className={`gallery-caption-thumb ${i === activeIndex ? 'active' : ''}`}
                onClick={() => setActiveIndex(i)}
              >
                {objectUrls[i] && <img src={objectUrls[i]} alt="" />}
                {item.type === 'VIDEO' && (
                  <span className="gallery-caption-thumb-video-badge">
                    <Icon icon={faPlay} />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="status-media-caption-row">
            <input
              className="composer-input"
              placeholder={`Add a caption (${items.length} items)`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              autoFocus
            />
            <button type="button" className="composer-send" onClick={handleSend} disabled={isSending}>
              {isSending ? <Spinner size={18} /> : <Icon icon={faPaperPlane} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
