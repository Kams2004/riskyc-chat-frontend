import { faFileLines, faPaperPlane, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

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

type MediaCaptionComposerProps = {
  media: PendingWebMedia | null;
  onCancel: () => void;
  onSend: (caption: string) => Promise<boolean>;
};

/** WhatsApp-style preview-with-caption screen shown before actually sending a picked photo, video, or document — same pattern mobile's MediaCaptionComposer already used, ported here since web previously uploaded and sent every attachment immediately with no confirmation step. */
export function MediaCaptionComposer({ media, onCancel, onSend }: MediaCaptionComposerProps) {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    setCaption('');
    if (!media) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(media.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
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
    <div className="modal-backdrop">
      <div className="media-caption-composer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-button media-caption-close" onClick={onCancel} title="Cancel">
          <Icon icon={faXmark} />
        </button>

        <div className="media-caption-preview">
          {media.kind === 'image' && objectUrl && <img src={objectUrl} alt="" />}
          {media.kind === 'video' && objectUrl && <video src={objectUrl} controls />}
          {media.kind === 'file' && (
            <div className="media-caption-file">
              <div className="media-caption-file-icon">
                <Icon icon={faFileLines} />
              </div>
              <div className="media-caption-file-name">{media.name}</div>
              <div className="media-caption-file-size">{formatFileSize(media.size)}</div>
            </div>
          )}
        </div>

        <div className="media-caption-bar">
          <input
            className="media-caption-input"
            placeholder="Add a caption…"
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
  );
}
