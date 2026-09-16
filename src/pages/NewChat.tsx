import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { conversationIdFor } from '../features/messaging/conversationId';
import { searchUsers, type UserResult } from '../features/users/api';
import { useAuth } from '../features/auth/AuthContext';

async function shareInviteLink() {
  const url = `${window.location.origin}/invite`;
  const shareData = { title: 'RiskyC Chat', text: 'Join me on RiskyC Chat', url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // User dismissed the share sheet — fall through to the clipboard copy below.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    window.alert('Invite link copied to clipboard.');
  } catch {
    window.alert(url);
  }
}

export function NewChatPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    setIsSearching(true);
    try {
      setResults(await searchUsers(q));
    } finally {
      setIsSearching(false);
    }
  }

  function openChatWith(user: UserResult) {
    if (!userId) return;
    const conversationId = conversationIdFor(userId, user.userId);
    navigate(`/chats/${conversationId}`, {
      state: { title: user.displayName || user.email || user.phoneNumber || 'Chat', avatarObjectKey: user.avatarObjectKey, recipientId: user.userId },
    });
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>New chat</h1>
      <div className="conversation-row" style={{ borderRadius: 10, marginBottom: 8 }} onClick={shareInviteLink}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'var(--brand-600)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          ↗
        </div>
        <div className="conversation-row-title">Invite a friend</div>
      </div>
      <input
        className="input"
        placeholder="Search by name, email or phone"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        autoFocus
      />
      {isSearching && <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Searching…</p>}
      <div style={{ marginTop: 12 }}>
        {results.map((u) => (
          <div key={u.userId} className="conversation-row" style={{ borderRadius: 10 }} onClick={() => openChatWith(u)}>
            <Avatar label={u.displayName || u.email || u.phoneNumber || '?'} objectKey={u.avatarObjectKey} size={40} />
            <div className="conversation-row-title">{u.displayName || u.email || u.phoneNumber}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
