import { faFileLines, faPaperPlane, faPenNib, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { renderPdfFirstPage } from '../lib/pdfPreview';
import { EMPTY_OVERLAY, isOverlayEmpty, serializeOverlay, type StatusOverlay } from '../lib/overlay';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { ImageEditor } from './ImageEditor';
import { OverlayView } from './OverlayView';
import { Spinner } from './Spinner';

export type PendingWebMedia =
  | { kind: 'image'; file: File }
  | { kind: 'video'; file: File }
  | { kind: 'file'; file: File; name: string; size: number };

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

type MediaCaptionComposerProps = {
  media: PendingWebMedia | null;
  onCancel: () => void;
  /** Receives the (possibly crop/rotate-edited) file and any drawing overlay, not just the original media.file — see ImageEditor's own comment on why crop/rotate bake into new file bytes while drawing stays a separate overlay. */
  onSend: (caption: string, file: File, overlayJson: string | null) => Promise<boolean>;
};

/**
 * WhatsApp-style preview-with-caption screen shown before actually sending
 * a picked photo, video, or document — same layout as StatusComposer's own
 * media step (.status-composer/.status-media-editor/.status-media-preview),
 * reused directly rather than a bespoke design, per how the two are meant
 * to look and feel the same. A PDF gets its actual first page rendered as
 * the preview image (via pdfjs-dist) instead of a generic file icon; any
 * other document type falls back to that icon. An IMAGE additionally gets
 * an "Edit" button opening ImageEditor for crop/rotate/draw.
 */
export function MediaCaptionComposer({ media, onCancel, onSend }: MediaCaptionComposerProps) {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [workingFile, setWorkingFile] = useState<File | null>(null);
  const [overlay, setOverlay] = useState<StatusOverlay>(EMPTY_OVERLAY);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setCaption('');
    setPdfPreviewUrl(null);
    setOverlay(EMPTY_OVERLAY);
    setWorkingFile(media?.file ?? null);
    if (!media) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(media.file);
    setObjectUrl(url);

    let cancelled = false;
    if (media.kind === 'file' && isPdf(media.file)) {
      setPdfPreviewLoading(true);
      renderPdfFirstPage(media.file).then((dataUrl) => {
        if (!cancelled) {
          setPdfPreviewUrl(dataUrl);
          setPdfPreviewLoading(false);
        }
      });
    }

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [media]);

  // Re-derive the preview URL whenever the working file changes (i.e. after
  // an edit), separate from the effect above which only fires on a brand
  // new `media` prop.
  useEffect(() => {
    if (!workingFile) return;
    const url = URL.createObjectURL(workingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [workingFile]);

  if (!media) return null;

  const hasUnsavedChanges = !!caption.trim() || workingFile !== media.file || !isOverlayEmpty(overlay);

  function handleCloseClick() {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
    } else {
      onCancel();
    }
  }

  async function handleSend() {
    if (isSending || !workingFile) return;
    setIsSending(true);
    try {
      const succeeded = await onSend(caption, workingFile, serializeOverlay(overlay));
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

            {media.kind === 'image' && (
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

            {media.kind === 'image' && objectUrl && (
              <div className="media-caption-preview-wrap">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={objectUrl} alt="" className="media-caption-preview-media" />
                  <OverlayView overlay={overlay} />
                </div>
              </div>
            )}

            {media.kind === 'video' && objectUrl && (
              <div className="media-caption-preview-wrap">
                <video src={objectUrl} controls playsInline className="media-caption-preview-media" />
              </div>
            )}

            {media.kind === 'file' && (
              <>
                {pdfPreviewUrl ? (
                  <div className="media-caption-preview-wrap">
                    <img src={pdfPreviewUrl} alt="" className="media-caption-preview-media media-caption-pdf-page" />
                  </div>
                ) : (
                  <div className="media-caption-file">
                    <div className="media-caption-file-icon">
                      {pdfPreviewLoading ? <Spinner size={22} /> : <Icon icon={faFileLines} />}
                    </div>
                  </div>
                )}
                <div className="media-caption-file-meta">
                  <div className="media-caption-file-name">{media.name}</div>
                  <div className="media-caption-file-size">{formatFileSize(media.size)}</div>
                </div>
              </>
            )}

            <div className="status-media-caption-row">
              <input
                className="composer-input"
                placeholder="Add a caption"
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

      {editorOpen && workingFile && media.kind === 'image' && (
        <ImageEditor
          file={workingFile}
          initialOverlay={overlay}
          onCancel={() => setEditorOpen(false)}
          onConfirm={({ file, overlay: nextOverlay }) => {
            setWorkingFile(file);
            setOverlay(nextOverlay);
            setEditorOpen(false);
          }}
        />
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this?"
          body="Your caption and any edits will be lost."
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onCancel}
        />
      )}
    </>
  );
}
