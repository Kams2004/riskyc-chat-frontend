import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import { deleteMyAccount, getUser } from '../features/users/api';
import { maskIdentifier } from '../lib/mask';

export function AccountPage() {
  const { userId, signOut } = useAuth();
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
      window.alert('Could not delete account — please check your connection and try again.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate('/settings')}>
        ← Back
      </button>
      <h1>Account</h1>

      <div className="settings-row" onClick={() => setIsRevealed((v) => !v)} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Registered with</p>
        <p className="settings-row-value">{identifier ? (isRevealed ? identifier : maskIdentifier(identifier)) : '—'}</p>
        <button className="settings-link" onClick={() => navigate('/settings/change-identifier', { state: { mode: identifierMode } })}>
          Change {identifierMode === 'phone' ? 'phone number' : 'email'}
        </button>
      </div>

      <button className="link-button" style={{ color: 'var(--error)', marginTop: 24 }} onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? 'Deleting…' : 'Delete account'}
      </button>
    </div>
  );
}
