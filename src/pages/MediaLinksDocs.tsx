import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMediaUrl } from '../features/media/useMediaUrl';
import { getMediaSummary, searchInConversation, type MediaSummaryItem, type SearchResult } from '../features/messaging/api';

type Tab = 'media' | 'links' | 'docs';
const URL_PATTERN = /https?:\/\/[^\s]+/g;

function MediaTile({ objectKey }: { objectKey: string }) {
  const url = useMediaUrl(objectKey);
  return (
    <div style={{ aspectRatio: '1', background: 'var(--tint1)' }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  );
}

export function MediaLinksDocsPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [tab, setTab] = useState<Tab>('media');
  const [media, setMedia] = useState<MediaSummaryItem[]>([]);
  const [docs, setDocs] = useState<MediaSummaryItem[]>([]);
  const [links, setLinks] = useState<{ messageId: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;
    Promise.all([
      getMediaSummary(conversationId, 'IMAGE,VIDEO', 100),
      getMediaSummary(conversationId, 'FILE', 100),
      searchInConversation(conversationId, 'http').catch(() => [] as SearchResult[]),
    ])
      .then(([mediaResult, docsResult, searchResult]) => {
        setMedia(mediaResult);
        setDocs(docsResult);
        const extracted: { messageId: string; url: string }[] = [];
        for (const m of searchResult) {
          const matches = m.ciphertext.match(URL_PATTERN);
          if (matches) for (const url of matches) extracted.push({ messageId: m.messageId, url });
        }
        setLinks(extracted);
      })
      .finally(() => setIsLoading(false));
  }, [conversationId]);

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Media, links, and docs</h1>

      <div className="toggle-row" style={{ marginBottom: 16 }}>
        {(['media', 'links', 'docs'] as Tab[]).map((t) => (
          <button key={t} type="button" className={`toggle-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      {!isLoading && tab === 'media' && (
        media.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No media shared yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {media.map((m) => (
              <MediaTile key={m.messageId} objectKey={m.mediaObjectKey} />
            ))}
          </div>
        )
      )}

      {!isLoading && tab === 'links' && (
        links.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No links shared yet.</p>
        ) : (
          links.map((l, i) => (
            <div key={l.messageId + i} className="settings-row">
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.url}
              </a>
            </div>
          ))
        )
      )}

      {!isLoading && tab === 'docs' && (
        docs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No documents shared yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.messageId} className="settings-row">
              {d.mediaFileName || 'Document'}
            </div>
          ))
        )
      )}
    </div>
  );
}
