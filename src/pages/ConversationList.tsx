import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { IconRail } from '../components/IconRail';
import { useAuth } from '../features/auth/AuthContext';
import { useConversationList } from '../features/messaging/useConversationList';
import { useInboxSocket } from '../features/messaging/useInboxSocket';
import type { ReplyToDraft } from '../features/messaging/useConversation';
import { ConversationThreadPage } from './ConversationThread';

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

  const activeConversation = conversations.find((c) => c.conversationId === conversationId);
  const navState = location.state as NavState | null;

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
              +
            </button>
          </div>
        </div>
        <div className="sidebar-list">
          {isLoading && conversations.length === 0 && <p style={{ padding: 18, color: 'var(--text-muted)' }}>Loading…</p>}
          {!isLoading && conversations.length === 0 && (
            <p style={{ padding: 18, color: 'var(--text-muted)' }}>No conversations yet — start one.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.conversationId}
              className={`conversation-row ${c.conversationId === conversationId ? 'active' : ''}`}
              onClick={() => navigate(`/chats/${c.conversationId}`)}
            >
              <Avatar label={c.title} objectKey={c.avatarObjectKey} size={44} />
              <div className="conversation-row-title">{c.title}</div>
              <span className="conversation-row-time">{formatListTime(c.lastMessageAt)}</span>
            </div>
          ))}
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
              <h2>RiskyC Chat for web</h2>
              <p>Send and receive messages without keeping your phone online.</p>
              <p className="empty-state-hint">Use RiskyC Chat on up to 4 linked devices and 1 phone at the same time.</p>
            </div>
            <div className="empty-state-actions">
              <button className="link-button" onClick={() => navigate('/chats/new')}>
                New chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
