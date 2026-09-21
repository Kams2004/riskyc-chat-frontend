import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { IconRail } from '../components/IconRail';
import { StatusComposer } from '../components/StatusComposer';
import { StatusViewer } from '../components/StatusViewer';
import { useAuth } from '../features/auth/AuthContext';
import { fetchStatusesFor, fetchStatusFeed, type StatusFeedEntry, type StatusItem } from '../features/status/api';
import { getUser, type UserResult } from '../features/users/api';

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusRow({
  name,
  avatarObjectKey,
  statuses,
  unviewed,
  onClick,
}: {
  name: string;
  avatarObjectKey: string | null;
  statuses: StatusItem[];
  unviewed: boolean;
  onClick: () => void;
}) {
  const latest = statuses[statuses.length - 1];
  return (
    <div className="conversation-row" onClick={onClick}>
      <div className={`status-ring ${unviewed ? 'unviewed' : 'viewed'}`}>
        <Avatar label={name} objectKey={avatarObjectKey} size={44} />
      </div>
      <div className="conversation-row-title">{name}</div>
      {!!latest && <span className="conversation-row-time">{formatRelative(latest.createdAt)}</span>}
    </div>
  );
}

/**
 * Two-pane slot the same way Chats occupies it — a left list of statuses
 * (mine + contacts', split Recent/Viewed like mobile's status/index.tsx),
 * with the viewer rendered as a full-screen overlay on top rather than in
 * a second pane (matches mobile's own full-screen story-viewer UX).
 */
export function StatusPage() {
  const { userId, displayName, avatarObjectKey } = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<StatusFeedEntry[]>([]);
  const [names, setNames] = useState<Record<string, UserResult>>({});
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerFor, setViewerFor] = useState<{ userId: string; statuses: StatusItem[] } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [feedResult, mine] = await Promise.all([
      fetchStatusFeed().catch(() => []),
      userId ? fetchStatusesFor(userId).catch(() => []) : Promise.resolve([]),
    ]);
    setFeed(feedResult);
    setMyStatuses(mine);
    const missing = feedResult.map((e) => e.userId).filter((id) => !names[id]);
    if (missing.length > 0) {
      const resolved = await Promise.all(missing.map((id) => getUser(id).catch(() => null)));
      setNames((prev) => {
        const next = { ...prev };
        resolved.forEach((u, i) => {
          if (u) next[missing[i]] = u;
        });
        return next;
      });
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const recent = feed.filter((e) => e.hasUnviewed);
  const viewed = feed.filter((e) => !e.hasUnviewed);

  return (
    <div className="app-shell">
      <IconRail />
      <aside className="sidebar">
        <div className="sidebar-header">
          <strong style={{ fontSize: 16 }}>Status</strong>
        </div>
        <div className="sidebar-list">
          <div className="conversation-row" onClick={() => (myStatuses.length > 0 ? setViewerFor({ userId: userId!, statuses: myStatuses }) : setComposerOpen(true))}>
            <div style={{ position: 'relative' }}>
              <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={44} />
              <span className="status-add-badge" onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}>
                +
              </span>
            </div>
            <div className="conversation-row-title">My status</div>
            <span className="conversation-row-time">{myStatuses.length > 0 ? 'Tap to view' : 'Add status update'}</span>
          </div>

          {isLoading && <p style={{ padding: 18, color: 'var(--text-muted)' }}>Loading…</p>}

          {!isLoading && recent.length > 0 && (
            <>
              <div className="status-section-label">Recent updates</div>
              {recent.map((e) => (
                <StatusRow
                  key={e.userId}
                  name={names[e.userId]?.displayName || 'Unknown'}
                  avatarObjectKey={names[e.userId]?.avatarObjectKey ?? null}
                  statuses={e.statuses}
                  unviewed
                  onClick={() => setViewerFor({ userId: e.userId, statuses: e.statuses })}
                />
              ))}
            </>
          )}

          {!isLoading && viewed.length > 0 && (
            <>
              <div className="status-section-label">Viewed updates</div>
              {viewed.map((e) => (
                <StatusRow
                  key={e.userId}
                  name={names[e.userId]?.displayName || 'Unknown'}
                  avatarObjectKey={names[e.userId]?.avatarObjectKey ?? null}
                  statuses={e.statuses}
                  unviewed={false}
                  onClick={() => setViewerFor({ userId: e.userId, statuses: e.statuses })}
                />
              ))}
            </>
          )}

          {!isLoading && feed.length === 0 && (
            <p style={{ padding: 18, color: 'var(--text-muted)' }}>No status updates from your contacts yet.</p>
          )}
        </div>
      </aside>

      <div className="main-panel">
        <div className="empty-state">
          <div className="empty-state-card">
            <svg width={100} height={100} viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="3 3" />
              <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
            <h2>Status updates</h2>
            <p>Select a status on the left to view it, or post your own.</p>
          </div>
          <div className="empty-state-actions">
            <button className="link-button" onClick={() => setComposerOpen(true)}>
              Add status update
            </button>
          </div>
        </div>
      </div>

      {composerOpen && (
        <StatusComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            load();
          }}
        />
      )}

      {viewerFor && (
        <StatusViewer
          initialStatuses={viewerFor.statuses}
          isOwn={viewerFor.userId === userId}
          onClose={() => setViewerFor(null)}
          onDeleted={load}
          onOpenReplyThread={(conversationId) => navigate(`/chats/${conversationId}`)}
        />
      )}
    </div>
  );
}
