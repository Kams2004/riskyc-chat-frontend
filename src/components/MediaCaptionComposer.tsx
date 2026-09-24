import { faFileLines, faPaperPlane, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { renderPdfFirstPage } from '../lib/pdfPreview';
import { Icon } from './Icon';
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
  onSend: (caption: string) => Promise<boolean>;
};

/**
 * WhatsApp-style preview-with-caption screen shown before actually sending
 * a picked photo, video, or document — same layout as StatusComposer's own
 * media step (.status-composer/.status-media-editor/.status-media-preview),
 * reused directly rather than a bespoke design, per how the two are meant
 * to look and feel the same. A PDF gets its actual first page rendered as
 * the preview image (via pdfjs-dist) instead of a generic file icon; any
 * other document type falls back to that icon.
 */
export function MediaCaptionComposer({ media, onCancel, onSend }: MediaCaptionComposerProps) {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  useEffect(() => {
    setCaption('');
    setPdfPreviewUrl(null);
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

  if (!media) return null;

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

          {media.kind === 'image' && objectUrl && (
            <div className="media-caption-preview-wrap">
              <img src={objectUrl} alt="" className="media-caption-preview-media" />
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
  );
}
