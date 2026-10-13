import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { useAuth } from '../features/auth/AuthContext';
import { deleteMyAccount, getUser } from '../features/users/api';
import { ApiError } from '../lib/httpClient';
import { maskIdentifier } from '../lib/mask';

export function AccountPage() {
  const { userId, isMaster, signOut } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [identifierMode, setIdentifierMode] = useState<'phone' | 'email'>('email');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getUser(userId).then((user) => {
      setIdentifier(user.email ?? user.phoneNumber);
      setIdentifierMode(user.email ? 'email' : 'phone');
    });
  }, [userId]);

  async function handleDelete() {
    if (!window.confirm("Delete your account? This can't be undone — you won't be reachable or discoverable anymore.")) return;
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      signOut();
      navigate('/', { replace: true });
    } catch (e) {
      // Defense in depth — the button below is already hidden for a
      // non-master device, but the server is the real enforcement (see
      // UserController#deleteMe), so a 403 here still needs a clear message
      // rather than the generic connection-error one.
      if (e instanceof ApiError && e.status === 403) {
        window.alert("Only the primary device — the one you originally verified this account on — can delete the account.");
      } else {
        window.alert('Could not delete account — please check your connection and try again.');
      }
      setIsDeleting(false);
    }
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate('/settings')}>
        <Icon icon={faArrowLeft} /> Back
      </button>
      <h1>Account</h1>

      <div className="settings-row" onClick={() => setIsRevealed((v) => !v)} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Registered with</p>
        <p className="settings-row-value">{identifier ? (isRevealed ? identifier : maskIdentifier(identifier)) : '—'}</p>
        <button className="settings-link" onClick={() => navigate('/settings/change-identifier', { state: { mode: identifierMode } })}>
          Change {identifierMode === 'phone' ? 'phone number' : 'email'}
        </button>
      </div>

      {isMaster ? (
        <button className="link-button" style={{ color: 'var(--error)', marginTop: 24 }} onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting…' : 'Delete account'}
        </button>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>Only the primary device can delete the account.</p>
      )}
    </div>
  );
}
