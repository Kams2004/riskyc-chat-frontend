import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/AuthContext';
import { getDeviceLimit, listSessions, revokeSession, type SessionResult } from '../features/sessions/api';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DevicesPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [maxLinkedDevices, setMaxLinkedDevices] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    Promise.all([listSessions(), getDeviceLimit()])
      .then(([sessionsResult, limitResult]) => {
        setSessions(sessionsResult);
        setMaxLinkedDevices(limitResult.maxLinkedDevices);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const activeSessions = sessions.filter((s) => !s.revoked);
  const revokedSessions = sessions.filter((s) => s.revoked);
  const myIsMaster = activeSessions.find((s) => s.isCurrent)?.isMaster ?? false;

  async function handleRevoke(item: SessionResult) {
    const cascadeWarning = item.isCurrent && item.isMaster;
    const confirmMsg = item.isCurrent
      ? cascadeWarning
        ? "Sign out this device? This is your primary device — signing out will also sign out every other linked device."
        : "Sign out this device? This is the one you're using right now — you'll be signed out immediately."
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

      {maxLinkedDevices != null && activeSessions.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          {activeSessions.length} of {maxLinkedDevices} devices linked
        </p>
      )}
      {!myIsMaster && activeSessions.length > 1 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 2 }}>Only the primary device can link or remove other devices.</p>
      )}

      {isLoading && sessions.length === 0 && <div className="loading-center"><Spinner /></div>}
      {!isLoading && activeSessions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active sessions.</p>}

      {activeSessions.map((item) => {
        // Any device may always sign ITSELF out. Removing an OTHER device is
        // master-only — a non-master viewer sees no action on other rows.
        const canRevoke = item.isCurrent || myIsMaster;
        return (
          <div key={item.id} className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p className="settings-row-value" style={{ margin: 0 }}>
                {item.deviceLabel || 'Unknown device'}
                {item.isCurrent && <span style={{ color: 'var(--brand-600)', fontSize: 12.5 }}> · This device</span>}
                {item.isMaster && <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}> · Primary device</span>}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>Active {formatWhen(item.lastSeenAt)}</p>
            </div>
            {canRevoke && (
              <button className="settings-link" disabled={revokingId === item.id} onClick={() => handleRevoke(item)}>
                {revokingId === item.id ? 'Signing out…' : 'Sign out'}
              </button>
            )}
          </div>
        );
      })}

      {revokedSessions.length > 0 && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, marginTop: 24, marginBottom: 4 }}>Recently signed out</p>
          {revokedSessions.map((item) => (
            <div key={item.id} className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p className="settings-row-value" style={{ margin: 0, color: 'var(--text-muted)' }}>{item.deviceLabel || 'Unknown device'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {item.revokedAt ? `Signed out ${formatWhen(item.revokedAt)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
