import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { IconRail } from '../components/IconRail';
import { useAuth } from '../features/auth/AuthContext';
import { useConversationList, type ConversationListItem } from '../features/messaging/useConversationList';
import { useInboxSocket } from '../features/messaging/useInboxSocket';
import type { ReplyToDraft } from '../features/messaging/useConversation';
import { isFavorite, isUnread, toggleFavorite } from '../lib/conversationPrefs';
import { ConversationThreadPage } from './ConversationThread';

type ListFilter = 'all' | 'unread' | 'favorites' | 'groups';

/**
 * Set by NewChatPage when starting a brand-new 1:1 thread that has no
 * messages/summary yet, OR by a quoted-reply jump (see ConversationThread's
 * navigateToMessage/replyPrivately) carrying where to scroll to or a reply
 * draft to prefill — same react-router `navigate(path, {state})` pattern
 * either way, so both are optional on the same shape.
 */
type NavState = {
  title?: string;
  avatarObjectKey?: string | null;
  recipientId?: string;
  scrollToMessageId?: string;
  replyDraft?: ReplyToDraft;
};

function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Two-pane layout (list + thread side by side) on desktop widths — a plain
 * chat-list-only screen the way mobile has one doesn't make sense once
 * there's room for both, so ConversationList always renders the sidebar and
 * lets ConversationThreadPage (routed via /chats/:conversationId) fill the
 * right pane when a thread is selected.
 */
export function ConversationListPage() {
  const { userId, accessToken, displayName, avatarObjectKey, signOut } = useAuth();
  const { conversations, isLoading, reload } = useConversationList(userId);
  // Keeps the list itself live for messages arriving in any conversation,
  // not just the one currently open (which handles its own live updates via
  // ConversationThread's own subscription) — see useInboxSocket's comment.
  useInboxSocket(accessToken, reload);
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { t } = useTranslation('web');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  // Bumped on every favorite toggle so the 'favorites' filter re-derives —
  // isFavorite() reads localStorage directly, not React state.
  const [favoritesTick, setFavoritesTick] = useState(0);

  const activeConversation = conversations.find((c) => c.conversationId === conversationId);
  const navState = location.state as NavState | null;

  const filtered = useMemo(() => {
    let list = conversations;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q));
    if (filter === 'unread') list = list.filter((c) => isUnread(c.conversationId, c.lastMessageAt));
    else if (filter === 'favorites') list = list.filter((c) => isFavorite(c.conversationId));
    else if (filter === 'groups') list = list.filter((c) => c.isGroup);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, query, filter, favoritesTick]);

  function handleToggleFavorite(e: React.MouseEvent, c: ConversationListItem) {
    e.stopPropagation();
    toggleFavorite(c.conversationId);
    setFavoritesTick((v) => v + 1);
  }

  return (
    // has-active-conversation drives the mobile-width layout swap (see
    // index.css's media query) — narrow viewports show either the sidebar
    // OR the thread full-width, never both squeezed together, matching how
    // a real mobile chat client behaves rather than the old 40vh-sidebar
    // stack that left neither pane usable.
    <div className={`app-shell ${conversationId ? 'has-active-conversation' : ''}`}>
      <IconRail />
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={36} />
            <strong style={{ fontSize: 14.5 }}>{displayName || 'You'}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-button" title="New chat" onClick={() => navigate('/chats/new')}>
              <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="sidebar-search-row">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx={11} cy={11} r={7} />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            className="sidebar-search-input"
            placeholder={t('sidebar.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="sidebar-filter-row">
          {(['all', 'unread', 'favorites', 'groups'] as ListFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`sidebar-filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? t('sidebar.filterAll') : f === 'unread' ? t('sidebar.filterUnread') : f === 'favorites' ? t('sidebar.filterFavorites') : t('sidebar.filterGroups')}
            </button>
          ))}
        </div>

        <div className="sidebar-list">
          {isLoading && conversations.length === 0 && <p style={{ padding: 18, color: 'var(--text-muted)' }}>Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p style={{ padding: 18, color: 'var(--text-muted)' }}>
              {conversations.length === 0 ? t('sidebar.noConversations') : t('sidebar.noMatches')}
            </p>
          )}
          {filtered.map((c) => {
            const unread = isUnread(c.conversationId, c.lastMessageAt);
            const favorited = isFavorite(c.conversationId);
            return (
              <div
                key={c.conversationId}
                className={`conversation-row ${c.conversationId === conversationId ? 'active' : ''}`}
                onClick={() => navigate(`/chats/${c.conversationId}`)}
              >
                <Avatar label={c.title} objectKey={c.avatarObjectKey} size={44} />
                <div className="conversation-row-title" style={unread ? { fontWeight: 700 } : undefined}>
                  {c.title}
                </div>
                <button
                  className="conversation-row-favorite"
                  title={favorited ? t('sidebar.removeFromFavorites') : t('sidebar.addToFavorites')}
                  onClick={(e) => handleToggleFavorite(e, c)}
                >
                  <Icon icon={favorited ? faStarSolid : faStarRegular} />
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="conversation-row-time">{formatListTime(c.lastMessageAt)}</span>
                  {unread && <span className="conversation-row-unread-dot" />}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
          <button
            className="link-button secondary"
            onClick={() => {
              signOut();
              navigate('/', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {conversationId ? (
        <ConversationThreadPage
          conversationId={conversationId}
          title={activeConversation?.title ?? navState?.title ?? 'Chat'}
          avatarObjectKey={activeConversation?.avatarObjectKey ?? navState?.avatarObjectKey ?? null}
          isGroup={activeConversation?.isGroup ?? false}
          recipientId={activeConversation ? (activeConversation.otherUserId ?? undefined) : navState?.recipientId}
          groupId={activeConversation?.groupId ?? undefined}
          scrollToMessageId={navState?.scrollToMessageId}
          initialReplyDraft={navState?.replyDraft}
          onMessageSent={reload}
        />
      ) : (
        <div className="main-panel">
          <div className="empty-state">
            <div className="empty-state-card">
              <svg width={120} height={120} viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <rect x={2} y={4} width={20} height={14} rx={2} />
                <path d="M8 21h8M12 17v4" />
                <path d="M8 9h8M8 12h5" />
              </svg>
              <h2>{t('emptyState.title')}</h2>
              <p>{t('emptyState.body')}</p>
              <p className="empty-state-hint">{t('emptyState.hint')}</p>
            </div>
            <div className="empty-state-actions">
              <button className="link-button" onClick={() => navigate('/chats/new')}>
                {t('emptyState.newChat')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
