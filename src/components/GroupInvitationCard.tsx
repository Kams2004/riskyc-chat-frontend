import { useState } from 'react';

import { Avatar } from './Avatar';

/**
 * The invitation itself IS this card, inline in the inviter/invitee's own
 * 1:1 conversation — no dedicated screen (see GroupInvitationMessageService
 * backend-side, and mobile's identical GroupInvitationCard in
 * [conversationId].tsx). Accept/decline only show for the invitee on a
 * still-PENDING card; every other state is read-only, including on the
 * inviter's own copy of the same card.
 */
export function GroupInvitationCard({
  groupName,
  groupAvatarObjectKey,
  status,
  isMine,
  onAccept,
  onDecline,
  onOpen,
}: {
  groupName: string | null | undefined;
  groupAvatarObjectKey: string | null | undefined;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | null | undefined;
  isMine: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onOpen: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const name = groupName || 'Unnamed group';
  const canRespond = !isMine && status === 'PENDING';
  const canOpen = status === 'ACCEPTED';

  let statusLabel: string | null = null;
  if (status === 'ACCEPTED') statusLabel = 'Invitation accepted';
  else if (status === 'DECLINED') statusLabel = 'Invitation declined';
  else if (status === 'EXPIRED') statusLabel = 'Invitation expired';
  else if (status === 'PENDING' && isMine) statusLabel = 'You invited them to join';

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      if (accept) await onAccept();
      else await onDecline();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invite-card" onClick={canOpen ? onOpen : undefined} style={canOpen ? { cursor: 'pointer' } : undefined}>
      <div className="invite-card-header">
        <Avatar objectKey={groupAvatarObjectKey ?? null} label={name} size={44} />
        <div className="invite-card-info">
          <div className="invite-card-name">{name}</div>
          {!isMine && <div className="invite-card-sub">Invited you to join</div>}
        </div>
      </div>

      {canRespond ? (
        busy ? (
          <div className="invite-card-busy">…</div>
        ) : (
          <div className="invite-card-actions">
            <button type="button" className="invite-card-decline" onClick={() => void respond(false)}>
              Decline
            </button>
            <button type="button" className="invite-card-accept" onClick={() => void respond(true)}>
              Accept
            </button>
          </div>
        )
      ) : (
        !!statusLabel && (
          <div className={`invite-card-status ${status === 'ACCEPTED' ? 'accepted' : ''}`}>
            {statusLabel}
            {canOpen ? ' · Tap to open the group' : ''}
          </div>
        )
      )}
      {status === 'EXPIRED' && isMine && (
        <div className="invite-card-hint">Ask them to send a new invite from the group.</div>
      )}
    </div>
  );
}
