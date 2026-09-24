import { faArrowLeft, faCheck, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/Spinner';
import { conversationIdFor } from '../features/messaging/conversationId';
import { lookupByPhone, searchUsers, type UserResult } from '../features/users/api';
import { useAuth } from '../features/auth/AuthContext';

/** True when the string looks like a phone number the user typed (not a name/email). */
function looksLikePhoneQuery(q: string): boolean {
  return /^[+\d][\d\s\-().]{3,}$/.test(q.trim());
}

/** Strips everything but a leading + and digits. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

async function shareInviteLink(phoneNumber?: string) {
  const url = `${window.location.origin}/invite`;
  const text = phoneNumber ? `Join me on RiskyC Chat — invite for ${phoneNumber}` : 'Join me on RiskyC Chat';
  const shareData = { title: 'RiskyC Chat', text, url };
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

type PhoneLookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; user: UserResult }
  | { kind: 'notFound'; typed: string };

export function NewChatPage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState<PhoneLookupState>({ kind: 'idle' });
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPhoneMode = looksLikePhoneQuery(query.trim());

  // Debounced server lookup whenever the query looks like a phone number —
  // same 400ms debounce and exact-match contract as mobile's new.tsx, so a
  // number with no account offers an Invite action instead of a dead end.
  useEffect(() => {
    const q = query.trim();
    if (!looksLikePhoneQuery(q)) {
      setPhoneLookup({ kind: 'idle' });
      return;
    }
    const norm = normalizePhone(q);
    setPhoneLookup({ kind: 'loading' });
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const user = await lookupByPhone(norm);
        setPhoneLookup(user ? { kind: 'found', user } : { kind: 'notFound', typed: norm });
      } catch {
        setPhoneLookup({ kind: 'idle' });
      }
    }, 400);
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, [query]);

  async function runSearch(q: string) {
    setQuery(q);
    if (looksLikePhoneQuery(q)) return;
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
        <Icon icon={faArrowLeft} /> Back
      </button>
      <h1>New chat</h1>
      <div className="conversation-row" style={{ borderRadius: 10, marginBottom: 8 }} onClick={() => shareInviteLink()}>
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
          <Icon icon={faUserPlus} />
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

      {isPhoneMode ? (
        <div style={{ marginTop: 12 }}>
          {phoneLookup.kind === 'loading' && (
            <div className="loading-center" style={{ padding: 20 }}>
              <Spinner size={28} />
            </div>
          )}
          {phoneLookup.kind === 'found' && (
            <div className="conversation-row" style={{ borderRadius: 10 }} onClick={() => openChatWith(phoneLookup.user)}>
              <Avatar
                label={phoneLookup.user.displayName || phoneLookup.user.phoneNumber || '?'}
                objectKey={phoneLookup.user.avatarObjectKey}
                size={40}
              />
              <div className="conversation-row-title" style={{ flex: 1 }}>
                {phoneLookup.user.displayName || phoneLookup.user.phoneNumber}
              </div>
              <span style={{ color: 'var(--brand-500)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <Icon icon={faCheck} /> On RiskyC
              </span>
            </div>
          )}
          {phoneLookup.kind === 'notFound' && (
            <div style={{ padding: '8px 4px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 10 }}>No RiskyC account found for {phoneLookup.typed}.</p>
              <button className="link-button" onClick={() => shareInviteLink(phoneLookup.typed)}>
                <Icon icon={faUserPlus} /> Invite {phoneLookup.typed}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {isSearching && <p style={{ color: 'var(--text-muted)' }}>Searching…</p>}
          {results.map((u) => (
            <div key={u.userId} className="conversation-row" style={{ borderRadius: 10 }} onClick={() => openChatWith(u)}>
              <Avatar label={u.displayName || u.email || u.phoneNumber || '?'} objectKey={u.avatarObjectKey} size={40} />
              <div className="conversation-row-title">{u.displayName || u.email || u.phoneNumber}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
