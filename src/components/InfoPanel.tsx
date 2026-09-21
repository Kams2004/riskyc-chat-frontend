import { faAngleLeft, faMagnifyingGlass, faPhone, faVideo, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useCall } from '../features/calls/CallContext';
import { useMediaUrl } from '../features/media/useMediaUrl';
import { getCommonGroups, type GroupResult } from '../features/groups/api';
import { getMediaSummary, searchInConversation, type MediaSummaryItem, type SearchResult } from '../features/messaging/api';
import { blockUser, getUser, listBlockedUsers, reportUser, unblockUser, type UserResult } from '../features/users/api';

export type InfoPanelView = 'contact' | 'media';

const URL_PATTERN = /https?:\/\/[^\s]+/g;

function MediaThumb({ objectKey, large }: { objectKey: string; large?: boolean }) {
  const url = useMediaUrl(objectKey);
  const size = large ? 64 : undefined;
  return (
    <div
      style={large ? { width: size, height: size, borderRadius: 8, overflow: 'hidden', background: 'var(--tint1)' } : { aspectRatio: '1', background: 'var(--tint1)' }}
    >
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  );
}

function ContactView({
  conversationId,
  recipientId,
  onOpenMedia,
  onOpenSearch,
}: {
  conversationId: string;
  recipientId: string;
  onOpenMedia: () => void;
  onOpenSearch: () => void;
}) {
  const { startCall } = useCall();
  const [user, setUser] = useState<UserResult | null>(null);
  const [media, setMedia] = useState<MediaSummaryItem[]>([]);
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getUser(recipientId),
      getMediaSummary(conversationId, 'IMAGE,VIDEO,FILE', 4).catch(() => []),
      getCommonGroups(recipientId).catch(() => []),
      listBlockedUsers().catch(() => []),
    ]).then(([userResult, mediaResult, groupsResult, blockedResult]) => {
      setUser(userResult);
      setMedia(mediaResult);
      setGroups(groupsResult);
      setIsBlocked(blockedResult.some((b) => b.userId === recipientId));
      setIsLoading(false);
    });
  }, [conversationId, recipientId]);

  async function handleToggleBlock() {
    const name = user?.displayName || 'this person';
    const msg = isBlocked
      ? `Unblock ${name}? You'll be able to call and message each other again.`
      : `Block ${name}? You won't receive calls or messages from them anymore.`;
    if (!window.confirm(msg)) return;
    if (isBlocked) await unblockUser(recipientId);
    else await blockUser(recipientId);
    setIsBlocked((v) => !v);
  }

  async function handleReport() {
    const reason = window.prompt(`Report ${user?.displayName || 'this person'} — briefly describe the issue:`);
    if (reason === null) return;
    await reportUser(recipientId, reason || 'Unspecified');
    window.alert('Thanks — we received your report.');
  }

  if (isLoading || !user) {
    return <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading…</p>;
  }

  const name = user.displayName || 'Unnamed user';

  return (
    <>
      <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Avatar label={name} objectKey={user.avatarObjectKey} size={92} />
        </div>
        <h2 style={{ marginBottom: 4 }}>{name}</h2>
        {!!user.phoneNumber && <p style={{ color: 'var(--text-muted)', margin: 0 }}>{user.phoneNumber}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 20, borderBottom: '1px solid var(--hairline)' }}>
        <button className="icon-button" title="Voice call" onClick={() => void startCall(recipientId, name, 'AUDIO')}>
          <Icon icon={faPhone} />
        </button>
        <button className="icon-button" title="Video call" onClick={() => void startCall(recipientId, name, 'VIDEO')}>
          <Icon icon={faVideo} />
        </button>
        <button className="icon-button" title="Search in conversation" onClick={onOpenSearch}>
          <Icon icon={faMagnifyingGlass} />
        </button>
      </div>

      <div className="settings-row" style={{ cursor: 'pointer' }} onClick={onOpenMedia}>
        <p className="settings-row-label">Media, links, and docs</p>
        {media.length === 0 ? (
          <p className="settings-row-value">Nothing shared yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {media.map((m) => (
              <MediaThumb key={m.messageId} objectKey={m.mediaObjectKey} large />
            ))}
          </div>
        )}
      </div>

      <div className="settings-row">
        <p className="settings-row-label">Groups in common</p>
        {groups.length === 0 ? (
          <p className="settings-row-value">No groups in common</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Avatar label={g.name} objectKey={g.avatarObjectKey} size={32} />
              <span>{g.name}</span>
            </div>
          ))
        )}
      </div>

      <div
        className="settings-row"
        style={{ cursor: 'pointer' }}
        onClick={() => window.alert('Creating groups from the web app is not built yet — use the mobile app for now.')}
      >
        <p className="settings-row-value">Create group with {name}</p>
      </div>
      <div className="settings-row" style={{ cursor: 'pointer' }} onClick={handleToggleBlock}>
        <p className="settings-row-value" style={{ color: 'var(--brand-700)' }}>
          {isBlocked ? `Unblock ${name}` : `Block ${name}`}
        </p>
      </div>
      <div className="settings-row" style={{ cursor: 'pointer' }} onClick={handleReport}>
        <p className="settings-row-value" style={{ color: 'var(--brand-700)' }}>
          Report {name}
        </p>
      </div>
    </>
  );
}

function MediaView({ conversationId }: { conversationId: string }) {
  type Tab = 'media' | 'links' | 'docs';
  const [tab, setTab] = useState<Tab>('media');
  const [media, setMedia] = useState<MediaSummaryItem[]>([]);
  const [docs, setDocs] = useState<MediaSummaryItem[]>([]);
  const [links, setLinks] = useState<{ messageId: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    <>
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
              <MediaThumb key={m.messageId} objectKey={m.mediaObjectKey} />
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
    </>
  );
}

/**
 * The 4th flex column next to the thread — folds what used to be three
 * separate full-page routes (ContactDetailsPage/MediaLinksDocsPage/
 * SearchInChatPage) into one in-place panel with its own back-stack, so
 * opening contact info never replaces the conversation view. See
 * joyful-tinkering-owl.md Phase 1.
 */
export function InfoPanel({
  conversationId,
  recipientId,
  initialView,
  onClose,
  onOpenSearch,
}: {
  conversationId: string;
  recipientId?: string;
  initialView: InfoPanelView;
  onClose: () => void;
  /** Search now happens inline in the thread itself (see ConversationThread's own search bar), not as a panel view — this closes the panel and opens that instead. */
  onOpenSearch: () => void;
}) {
  const { t } = useTranslation('web');
  const viewTitle: Record<InfoPanelView, string> = { contact: t('infoPanel.contactInfo'), media: t('infoPanel.mediaLinksDocs') };
  const [view, setView] = useState<InfoPanelView>(initialView);
  const [history, setHistory] = useState<InfoPanelView[]>([]);

  useEffect(() => {
    setView(initialView);
    setHistory([]);
  }, [initialView, conversationId]);

  function push(next: InfoPanelView) {
    setHistory((h) => [...h, view]);
    setView(next);
  }

  function back() {
    setHistory((h) => {
      if (h.length === 0) {
        onClose();
        return h;
      }
      const copy = [...h];
      const prev = copy.pop()!;
      setView(prev);
      return copy;
    });
  }

  return (
    <aside className="info-panel">
      <div className="info-panel-header">
        <button className="icon-button" title={history.length > 0 ? 'Back' : 'Close'} onClick={back}>
          <Icon icon={history.length > 0 ? faAngleLeft : faXmark} />
        </button>
        <strong style={{ fontSize: 15 }}>{viewTitle[view]}</strong>
        {history.length > 0 && (
          <button className="icon-button" title="Close" onClick={onClose} style={{ marginLeft: 'auto' }}>
            <Icon icon={faXmark} />
          </button>
        )}
      </div>
      <div className="info-panel-body">
        {view === 'contact' && recipientId && (
          <ContactView
            conversationId={conversationId}
            recipientId={recipientId}
            onOpenMedia={() => push('media')}
            onOpenSearch={onOpenSearch}
          />
        )}
        {view === 'media' && <MediaView conversationId={conversationId} />}
      </div>
    </aside>
  );
}
