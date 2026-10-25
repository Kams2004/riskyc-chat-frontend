import { faArrowLeft, faCheck, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/Spinner';
import { conversationIdFor } from '../features/messaging/conversationId';
import { useConversationList } from '../features/messaging/useConversationList';
import { lookupByPhone, type UserResult } from '../features/users/api';
import { useAuth } from '../features/auth/AuthContext';
import { COUNTRIES, type Country } from '../lib/countries';

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
  const [phoneLookup, setPhoneLookup] = useState<PhoneLookupState>({ kind: 'idle' });
  // No open "search every user by name" endpoint exists anymore — same
  // privacy model as mobile's new.tsx: a stranger can only be found by
  // their exact phone number (lookupByPhone below). A typed name just
  // filters among people you ALREADY have a conversation with, since web
  // has no device-contacts list to match against like mobile does.
  const { conversations } = useConversationList(userId);
  const nameMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || looksLikePhoneQuery(q)) return [];
    return conversations.filter((c) => !c.isGroup && c.otherUserId && c.title.toLowerCase().includes(q));
  }, [conversations, query]);
  // Same default/role as mobile's new.tsx searchCountry — a bare local
  // number (no leading '+') gets this dial code prepended before lookup,
  // since the backend matches the full internationally-formatted number
  // exactly. Was missing entirely on web: a typed "650111222" would never
  // match a real "+237650111222" account.
  const [searchCountry, setSearchCountry] = useState<Country>(COUNTRIES[0]);
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
    const normDigits = normalizePhone(q);
    const norm = normDigits.startsWith('+') ? normDigits : `${searchCountry.dialCode}${normDigits}`;
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
  }, [query, searchCountry]);

  function openChatWith(user: UserResult) {
    if (!userId) return;
    const conversationId = conversationIdFor(userId, user.userId);
    navigate(`/chats/${conversationId}`, {
      state: { title: user.displayName || user.phoneNumber || user.email || 'Chat', avatarObjectKey: user.avatarObjectKey, recipientId: user.userId },
    });
  }

  function openChatWithRecipientId(recipientId: string, title: string, avatarObjectKey: string | null) {
    if (!userId) return;
    const conversationId = conversationIdFor(userId, recipientId);
    navigate(`/chats/${conversationId}`, { state: { title, avatarObjectKey, recipientId } });
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
        placeholder="Search your chats by name, or type a phone number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {isPhoneMode ? (
        <div style={{ marginTop: 12 }}>
          {/* Only matters for a bare local number with no leading '+' — see the lookup effect above. */}
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12.5, marginRight: 6 }}>Country:</span>
            <select
              className="input"
              style={{ width: 'auto', display: 'inline-block' }}
              aria-label="Country"
              value={searchCountry.dialCode}
              onChange={(e) => setSearchCountry(COUNTRIES.find((c) => c.dialCode === e.target.value) ?? COUNTRIES[0])}
            >
              {COUNTRIES.map((c) => (
                <option key={`${c.name}-${c.dialCode}`} value={c.dialCode}>
                  {c.name} ({c.dialCode})
                </option>
              ))}
            </select>
          </label>
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
          {query.trim() && nameMatches.length === 0 && (
            <p style={{ color: 'var(--text-muted)', padding: '8px 4px' }}>
              No match in your existing chats — try their exact phone number instead.
            </p>
          )}
          {nameMatches.map((c) => (
            <div
              key={c.conversationId}
              className="conversation-row"
              style={{ borderRadius: 10 }}
              onClick={() => openChatWithRecipientId(c.otherUserId!, c.title, c.avatarObjectKey)}
            >
              <Avatar label={c.title} objectKey={c.avatarObjectKey} size={40} />
              <div className="conversation-row-title">{c.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
