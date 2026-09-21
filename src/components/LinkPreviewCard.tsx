import { useEffect, useState } from 'react';

import { fetchLinkPreview, type LinkPreview } from '../features/messaging/api';

const URL_PATTERN = /https?:\/\/[^\s]+/i;

/** First URL in a message's text, or null — used to decide whether to even attempt a preview fetch. */
export function firstUrlIn(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match ? match[0] : null;
}

// Module-level, not per-component-instance: the same link pasted into many
// messages (or the same message re-rendered) should only ever be fetched
// once per page session.
const previewCache = new Map<string, LinkPreview | 'loading' | 'failed'>();

/** WhatsApp-style link preview card, rendered below a message's own text when it contains a URL — port of mobile's LinkPreviewCard. */
export function LinkPreviewCard({ url, isMine }: { url: string; isMine: boolean }) {
  const [preview, setPreview] = useState<LinkPreview | 'loading' | 'failed'>(previewCache.get(url) ?? 'loading');

  useEffect(() => {
    const cached = previewCache.get(url);
    if (cached) {
      setPreview(cached);
      return;
    }
    let cancelled = false;
    previewCache.set(url, 'loading');
    fetchLinkPreview(url)
      .then((result) => {
        const resolved = result.title || result.description || result.imageUrl ? result : 'failed';
        previewCache.set(url, resolved);
        if (!cancelled) setPreview(resolved);
      })
      .catch(() => {
        previewCache.set(url, 'failed');
        if (!cancelled) setPreview('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (preview === 'loading' || preview === 'failed') return null;

  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={`link-preview-card ${isMine ? 'mine' : ''}`}>
      {!!preview.imageUrl && <img src={preview.imageUrl} alt="" className="link-preview-image" />}
      <div className="link-preview-text">
        {!!preview.siteName && <div className="link-preview-site">{preview.siteName.toUpperCase()}</div>}
        {!!preview.title && <div className="link-preview-title">{preview.title}</div>}
        {!!preview.description && <div className="link-preview-description">{preview.description}</div>}
      </div>
    </a>
  );
}
