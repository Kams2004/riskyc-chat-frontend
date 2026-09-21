import { useEffect, useState } from 'react';

import { Avatar } from '../components/Avatar';
import { IconRail } from '../components/IconRail';
import { useAuth } from '../features/auth/AuthContext';
import { listCallHistory, type CallResult } from '../features/calls/api';
import { useCall } from '../features/calls/CallContext';
import { UNRESOLVED_PERSON_PLACEHOLDER } from '../features/messaging/conversationId';
import { getUser } from '../features/users/api';

type CallRow = CallResult & { otherName: string; otherAvatarKey: string | null; isOutgoing: boolean };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function statusLabel(row: CallRow): string {
  if (row.status === 'MISSED') return 'Missed';
  if (row.status === 'DECLINED') return 'Declined';
  return row.isOutgoing ? 'Outgoing' : 'Incoming';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Web port of mobile's calls.tsx — history list + redial via the new 1:1 CallContext (see joyful-tinkering-owl.md Phase 3). */
export function CallsPage() {
  const { userId } = useAuth();
  const { startCall } = useCall();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listCallHistory()
      .then(async (results) => {
        const rows = await Promise.all(
          results.map(async (call) => {
            const isOutgoing = call.callerId === userId;
            const otherId = isOutgoing ? call.calleeId : call.callerId;
            const user = await getUser(otherId).catch(() => null);
            return {
              ...call,
              isOutgoing,
              otherName: user?.displayName || UNRESOLVED_PERSON_PLACEHOLDER,
              otherAvatarKey: user?.avatarObjectKey ?? null,
            };
          })
        );
        if (!cancelled) setCalls(rows);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function redial(row: CallRow, type: 'AUDIO' | 'VIDEO') {
    const otherId = row.isOutgoing ? row.calleeId : row.callerId;
    startCall(otherId, row.otherName, type);
  }

  return (
    <div className="app-shell">
      <IconRail />
      <aside className="sidebar" style={{ width: '100%' }}>
        <div className="sidebar-header">
          <strong style={{ fontSize: 16 }}>Calls</strong>
        </div>
        <div className="sidebar-list">
          {isLoading && <p style={{ padding: 18, color: 'var(--text-muted)' }}>Loading…</p>}
          {!isLoading && calls.length === 0 && <p style={{ padding: 18, color: 'var(--text-muted)' }}>No calls yet.</p>}
          {calls.map((item) => {
            const myBytesSent = item.isOutgoing ? item.callerBytesSent : item.calleeBytesSent;
            const myBytesReceived = item.isOutgoing ? item.callerBytesReceived : item.calleeBytesReceived;
            const hasUsage = myBytesSent != null || myBytesReceived != null;
            return (
              <div key={item.id} className="conversation-row" onClick={() => redial(item, item.type)}>
                <Avatar objectKey={item.otherAvatarKey} label={item.otherName} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="conversation-row-title">{item.otherName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={item.status === 'MISSED' ? '#e53935' : 'var(--text-muted)'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      {item.isOutgoing ? <path d="M7 17L17 7M17 7H9M17 7v8" /> : <path d="M17 7L7 17M7 17h8M7 17V9" />}
                    </svg>
                    <span style={{ fontSize: 12.5, color: item.status === 'MISSED' ? '#e53935' : 'var(--text-muted)' }}>
                      {statusLabel(item)} · {formatWhen(item.startedAt)}
                    </span>
                  </div>
                  {hasUsage && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      You used {formatBytes((myBytesSent ?? 0) + (myBytesReceived ?? 0))}
                    </div>
                  )}
                </div>
                <button
                  className="icon-button"
                  title={item.type === 'VIDEO' ? 'Video call' : 'Voice call'}
                  onClick={(e) => {
                    e.stopPropagation();
                    redial(item, item.type);
                  }}
                >
                  {item.type === 'VIDEO' ? '🎥' : '📞'}
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
