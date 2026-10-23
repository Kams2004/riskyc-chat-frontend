import { useEffect, useRef } from 'react';

import type { GroupReceiptUpdate, MessageStatusUpdate } from './api';
import { ChatSocket } from './ws';

/**
 * App-wide counterpart to mobile's useInboxSocket — web never had one, so a
 * new message arriving for a conversation other than the currently-open
 * thread (or arriving while the sidebar is showing the list) never moved
 * that conversation to the top or updated its preview until a manual
 * reload. This just needs to trigger `onMessage` (the list's own `reload`)
 * for every /user/queue/messages frame; the thread screen's own
 * subscribeToConversation already handles the open-thread case separately.
 *
 * Also mirrors this account's own read state across its other sessions —
 * see ChatController#ack/#ackGroup/#syncRead — so marking a conversation
 * read on one linked device (mobile or another web tab) clears this
 * device's unread dot too, instead of only on its own next visit to that
 * thread.
 */
export function useInboxSocket(
  accessToken: string | null,
  onMessage: () => void,
  onReadState?: (update: MessageStatusUpdate | GroupReceiptUpdate) => void
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onReadStateRef = useRef(onReadState);
  onReadStateRef.current = onReadState;

  useEffect(() => {
    if (!accessToken) return;
    const socket = new ChatSocket(accessToken);
    socket.connect(() => {
      socket.subscribeToUserQueue(() => onMessageRef.current());
      socket.subscribeToUserReadState((update) => onReadStateRef.current?.(update));
    });
    return () => socket.disconnect();
  }, [accessToken]);
}
