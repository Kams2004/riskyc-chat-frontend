import { useEffect, useRef } from 'react';

import { ChatSocket } from './ws';

/**
 * App-wide counterpart to mobile's useInboxSocket — web never had one, so a
 * new message arriving for a conversation other than the currently-open
 * thread (or arriving while the sidebar is showing the list) never moved
 * that conversation to the top or updated its preview until a manual
 * reload. This just needs to trigger `onMessage` (the list's own `reload`)
 * for every /user/queue/messages frame; the thread screen's own
 * subscribeToConversation already handles the open-thread case separately.
 */
export function useInboxSocket(accessToken: string | null, onMessage: () => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!accessToken) return;
    const socket = new ChatSocket(accessToken);
    socket.connect(() => {
      socket.subscribeToUserQueue(() => onMessageRef.current());
    });
    return () => socket.disconnect();
  }, [accessToken]);
}
