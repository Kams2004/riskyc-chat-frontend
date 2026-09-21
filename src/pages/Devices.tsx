import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { useAuth } from '../features/auth/AuthContext';
import { listSessions, revokeSession, type SessionResult } from '../features/sessions/api';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DevicesPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleRevoke(item: SessionResult) {
    const confirmMsg = item.isCurrent
      ? "Sign out this device? This is the one you're using right now — you'll be signed out immediately."
      : `Sign out "${item.deviceLabel || 'this device'}"? It will be signed out the next time it tries to use the app.`;
    if (!window.confirm(confirmMsg)) return;

    setRevokingId(item.id);
    try {
      await revokeSession(item.id);
      if (item.isCurrent) {
        signOut();
        navigate('/', { replace: true });
        return;
      }
      load();
    } catch {
      window.alert('Could not sign out that device — please check your connection and try again.');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate('/settings')}>
        <Icon icon={faArrowLeft} /> Back
      </button>
      <h1>Logged-in devices</h1>

      {isLoading && sessions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {!isLoading && sessions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active sessions.</p>}

      {sessions.map((item) => (
        <div key={item.id} className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p className="settings-row-value" style={{ margin: 0 }}>
              {item.deviceLabel || 'Unknown device'}
              {item.isCurrent && <span style={{ color: 'var(--brand-600)', fontSize: 12.5 }}> · This device</span>}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>Active {formatWhen(item.lastSeenAt)}</p>
          </div>
          <button className="settings-link" disabled={revokingId === item.id} onClick={() => handleRevoke(item)}>
            {revokingId === item.id ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ))}
    </div>
  );
}
