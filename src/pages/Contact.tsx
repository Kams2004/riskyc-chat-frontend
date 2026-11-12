import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../features/auth/AuthContext';
import { normalizeLinkPhone, rememberPendingContactPath } from '../features/contactLink/pendingContactLink';
import { conversationIdFor } from '../features/messaging/conversationId';
import { lookupByPhone } from '../features/users/api';

type State = 'opening' | 'notFound' | 'invalid' | 'yourself' | 'error';

/**
 * /contact?phone=%2B2376…&name=Shop — opened from outside (e.g. a "Contact on RiskyC Chat" button on a shop's page).
 * Goes straight into the 1:1 chat with whoever owns that number, or says the number isn't on RiskyC Chat yet. Signed
 * out, the link is remembered and sign-in comes back here.
 */
export function ContactPage() {
  const { userId, phoneNumber } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('chats');
  const [state, setState] = useState<State>('opening');
  const [attempt, setAttempt] = useState(0);

  const phone = (params.get('phone') ?? '').trim();
  const name = (params.get('name') ?? '').trim();
  const label = name || phone;

  useEffect(() => {
    if (!userId) return;
    if (!phone) {
      setState('invalid');
      return;
    }
    const target = normalizeLinkPhone(phone, phoneNumber);
    if (phoneNumber && target === phoneNumber) {
      setState('yourself');
      return;
    }
    let cancelled = false;
    setState('opening');
    lookupByPhone(target)
      .then((user) => {
        if (cancelled) return;
        if (!user) {
          setState('notFound');
          return;
        }
        // Same navigation as the New chat page: the 1:1 conversation id is derived from both user ids.
        navigate(`/chats/${conversationIdFor(userId, user.userId)}`, {
          replace: true,
          state: { title: user.displayName || name || user.phoneNumber || 'Chat', avatarObjectKey: user.avatarObjectKey, recipientId: user.userId },
        });
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, phoneNumber, phone, name, navigate, attempt]);

  // Signed out: remember this link, sign in, and SignIn brings the user back here.
  if (!userId) {
    rememberPendingContactPath(`${location.pathname}${location.search}`);
    return <Navigate to="/" replace />;
  }
  if (state === 'opening') {
    return (
      <div className="legal-page" style={{ textAlign: 'center' }}>
        <p>{t('contactLink.opening')}</p>
      </div>
    );
  }

  const title =
    state === 'notFound'
      ? t('contactLink.notOnRiskyc', { name: label })
      : state === 'invalid'
        ? t('contactLink.invalidTitle')
        : state === 'yourself'
          ? t('contactLink.yourself')
          : t('contactLink.errorTitle');
  const body =
    state === 'notFound' ? t('contactLink.notOnRiskycBody') : state === 'invalid' ? t('contactLink.invalidBody') : state === 'error' ? t('contactLink.errorBody') : '';

  const invite = async () => {
    const url = `${window.location.origin}/invite`;
    const text = name ? t('newChat.inviteContactMessage', { name, url }) : t('newChat.inviteMessage', { url });
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RiskyC Chat', text, url });
        return;
      } catch {
        // dismissed — fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard blocked — nothing else to do
    }
  };

  return (
    <div className="legal-page" style={{ textAlign: 'center' }}>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {state === 'notFound' && (
        <button className="button" style={{ marginTop: 20 }} onClick={invite}>
          {t('contactLink.invite')}
        </button>
      )}
      {state === 'error' && (
        <button className="button" style={{ marginTop: 20 }} onClick={() => setAttempt((n) => n + 1)}>
          {t('contactLink.retry')}
        </button>
      )}
      <div>
        <button className="link-button" style={{ marginTop: 18 }} onClick={() => navigate('/chats', { replace: true })}>
          {t('contactLink.close')}
        </button>
      </div>
    </div>
  );
}
