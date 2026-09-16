import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../features/auth/AuthContext';
import { IncomingGroupCallListener, type GroupCallInviteMessage } from '../features/calls/incomingGroupCallInvite';
import { useGroupCall } from '../features/calls/GroupCallContext';

/**
 * Web has no per-conversation-list group-name lookup handy at the app root,
 * so the banner shows the caller's name (same info mobile's CallOverlay
 * leads with) rather than the group name — good enough to identify the call.
 */
export function IncomingGroupCallBanner() {
  const { userId, accessToken } = useAuth();
  const { groupCallState, joinGroupCall } = useGroupCall();
  const [invite, setInvite] = useState<GroupCallInviteMessage | null>(null);
  const listenerRef = useRef<IncomingGroupCallListener | null>(null);

  useEffect(() => {
    if (!userId || !accessToken) return;
    const listener = new IncomingGroupCallListener(accessToken, (msg) => setInvite(msg));
    listenerRef.current = listener;
    listener.connect();
    return () => {
      listener.disconnect();
      listenerRef.current = null;
    };
  }, [userId, accessToken]);

  if (!invite || groupCallState !== 'idle') return null;

  return (
    <div className="incoming-call-banner">
      <div>
        <strong>{invite.callerName}</strong> started a {invite.callType === 'VIDEO' ? 'video' : 'audio'} group call
      </div>
      <div className="incoming-call-banner-actions">
        <button
          className="link-button secondary"
          onClick={() => setInvite(null)}
        >
          Dismiss
        </button>
        <button
          className="link-button"
          onClick={() => {
            void joinGroupCall(invite.groupId, invite.callerName, invite.callType);
            setInvite(null);
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
