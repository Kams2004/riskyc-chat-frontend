import { faPaperPlane, faPenNib, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { EMPTY_OVERLAY, isOverlayEmpty, serializeOverlay, type StatusOverlay } from '../lib/overlay';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { ImageEditor } from './ImageEditor';
import { OverlayView } from './OverlayView';
import { Spinner } from './Spinner';

export type PendingGalleryFile = { file: File; type: 'IMAGE' | 'VIDEO' };
export type SentGalleryItem = { file: File; type: 'IMAGE' | 'VIDEO'; overlayJson: string | null };

type GalleryCaptionComposerProps = {
  items: PendingGalleryFile[] | null;
  onCancel: () => void;
  onSend: (caption: string, items: SentGalleryItem[]) => Promise<boolean>;
};

/**
 * Same idea as MediaCaptionComposer but for a multi-image/video send — a
 * large preview of whichever thumbnail is active plus a row to switch
 * between them, since there's no room to show every item large at once.
 * Each IMAGE item can be crop/rotate/draw/text-edited independently (same
 * ImageEditor as the single-file flow) — edits are tracked per-item in
 * local working state and only reach the parent once Send is tapped.
 */
export function GalleryCaptionComposer({ items, onCancel, onSend }: GalleryCaptionComposerProps) {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [workingFiles, setWorkingFiles] = useState<File[]>([]);
  const [overlays, setOverlays] = useState<StatusOverlay[]>([]);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setCaption('');
    setActiveIndex(0);
    if (!items || items.length === 0) {
      setWorkingFiles([]);
      setOverlays([]);
      return;
    }
    setWorkingFiles(items.map((i) => i.file));
    setOverlays(items.map(() => EMPTY_OVERLAY));
  }, [items]);

  useEffect(() => {
    if (workingFiles.length === 0) {
      setObjectUrls([]);
      return;
    }
    const urls = workingFiles.map((f) => URL.createObjectURL(f));
    setObjectUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [workingFiles]);

  if (!items || items.length === 0) return null;
  const clampedIndex = Math.min(activeIndex, items.length - 1);
  const activeType = items[clampedIndex].type;
  const activeUrl = objectUrls[clampedIndex];
  const activeOverlay = overlays[clampedIndex] ?? EMPTY_OVERLAY;
  const activeWorkingFile = workingFiles[clampedIndex];

  const hasUnsavedChanges =
    !!caption.trim() ||
    workingFiles.some((f, i) => f !== items[i]?.file) ||
    overlays.some((o) => !isOverlayEmpty(o));

  function handleCloseClick() {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
    } else {
      onCancel();
    }
  }

  async function handleSend() {
    if (isSending) return;
    setIsSending(true);
    try {
      const sentItems: SentGalleryItem[] = items!.map((item, i) => ({
        file: workingFiles[i] ?? item.file,
        type: item.type,
        overlayJson: serializeOverlay(overlays[i] ?? EMPTY_OVERLAY),
      }));
      const succeeded = await onSend(caption, sentItems);
      if (succeeded) setCaption('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={handleCloseClick}>
        <div className="status-composer" onClick={(e) => e.stopPropagation()}>
          <div className="media-caption-editor">
            <button type="button" className="icon-button status-composer-close" onClick={handleCloseClick} title="Cancel">
              <Icon icon={faXmark} />
            </button>

            {activeType === 'IMAGE' && (
              <button
                type="button"
                className="icon-button status-composer-close"
                style={{ left: 'auto', right: 12 }}
                onClick={() => setEditorOpen(true)}
                title="Edit"
              >
                <Icon icon={faPenNib} />
              </button>
            )}

            <div className="media-caption-preview-wrap">
              {activeType === 'IMAGE' ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={activeUrl} alt="" className="media-caption-preview-media" />
                  <OverlayView overlay={activeOverlay} />
                </div>
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

      {editorOpen && activeType === 'IMAGE' && activeWorkingFile && (
        <ImageEditor
          file={activeWorkingFile}
          initialOverlay={activeOverlay}
          onCancel={() => setEditorOpen(false)}
          onConfirm={({ file, overlay }) => {
            setWorkingFiles((prev) => prev.map((f, i) => (i === clampedIndex ? file : f)));
            setOverlays((prev) => prev.map((o, i) => (i === clampedIndex ? overlay : o)));
            setEditorOpen(false);
          }}
        />
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard these?"
          body="Your caption and any edits will be lost."
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onCancel}
        />
      )}
    </>
  );
}
