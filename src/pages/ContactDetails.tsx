import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { getCommonGroups, type GroupResult } from '../features/groups/api';
import { useMediaUrl } from '../features/media/useMediaUrl';
import { getMediaSummary, type MediaSummaryItem } from '../features/messaging/api';
import { blockUser, getUser, listBlockedUsers, reportUser, unblockUser, type UserResult } from '../features/users/api';

function MediaThumb({ objectKey }: { objectKey: string }) {
  const url = useMediaUrl(objectKey);
  return (
    <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--tint1)' }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  );
}

export function ContactDetailsPage() {
  const navigate = useNavigate();
  const { conversationId, userId } = useParams<{ conversationId: string; userId: string }>();

  const [user, setUser] = useState<UserResult | null>(null);
  const [media, setMedia] = useState<MediaSummaryItem[]>([]);
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !conversationId) return;
    Promise.all([
      getUser(userId),
      getMediaSummary(conversationId, 'IMAGE,VIDEO,FILE', 4).catch(() => []),
      getCommonGroups(userId).catch(() => []),
      listBlockedUsers().catch(() => []),
    ]).then(([userResult, mediaResult, groupsResult, blockedResult]) => {
      setUser(userResult);
      setMedia(mediaResult);
      setGroups(groupsResult);
      setIsBlocked(blockedResult.some((b) => b.userId === userId));
      setIsLoading(false);
    });
  }, [conversationId, userId]);

  async function handleToggleBlock() {
    if (!userId) return;
    const name = user?.displayName || 'this person';
    const msg = isBlocked
      ? `Unblock ${name}? You'll be able to call and message each other again.`
      : `Block ${name}? You won't receive calls or messages from them anymore.`;
    if (!window.confirm(msg)) return;
    if (isBlocked) await unblockUser(userId);
    else await blockUser(userId);
    setIsBlocked((v) => !v);
  }

  async function handleReport() {
    if (!userId) return;
    const reason = window.prompt(`Report ${user?.displayName || 'this person'} — briefly describe the issue:`);
    if (reason === null) return;
    await reportUser(userId, reason || 'Unspecified');
    window.alert('Thanks — we received your report.');
  }

  if (isLoading || !user || !userId || !conversationId) {
    return (
      <div className="settings-page">
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  const name = user.displayName || 'Unnamed user';

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Avatar label={name} objectKey={user.avatarObjectKey} size={92} />
        </div>
        <h1 style={{ marginBottom: 4 }}>{name}</h1>
        {!!user.phoneNumber && <p style={{ color: 'var(--text-muted)', margin: 0 }}>{user.phoneNumber}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, paddingBottom: 20, borderBottom: '1px solid var(--hairline)' }}>
        <button className="icon-button" title="Voice call (mobile only for now)" onClick={() => window.alert('Calling from the web app is not built yet — use the mobile app for now.')}>
          📞
        </button>
        <button className="icon-button" title="Video call (mobile only for now)" onClick={() => window.alert('Calling from the web app is not built yet — use the mobile app for now.')}>
          🎥
        </button>
        <button className="icon-button" title="Search" onClick={() => navigate(`/chats/${conversationId}/search`)}>
          🔍
        </button>
      </div>

      <div className="settings-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/chats/${conversationId}/media`)}>
        <p className="settings-row-label">Media, links, and docs</p>
        {media.length === 0 ? (
          <p className="settings-row-value">Nothing shared yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {media.map((m) => (
              <MediaThumb key={m.messageId} objectKey={m.mediaObjectKey} />
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
    </div>
  );
}
