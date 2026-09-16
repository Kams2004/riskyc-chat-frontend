import { Client, type IMessage } from '@stomp/stompjs';

import { messagingWebSocketUrl } from '../../lib/config';
import type { GroupCallType } from './groupCallSignaling';

export type GroupCallInviteMessage = { roomId: string; groupId: string; callerId: string; callerName: string; callType: GroupCallType };

/**
 * Web has no existing 1:1-call STOMP connection to extend (unlike mobile's
 * CallSignalingSocket) — this is a small, dedicated connection to the same
 * /user/queue/calls destination messaging-service's GroupCallController
 * fans invites out to, filtering for callMessageType=group-invite only.
 * A second concurrent STOMP connection per browser tab is already an
 * accepted pattern in this codebase (mobile runs an app-wide InboxSocket
 * alongside each open thread's own ChatSocket) — nothing new architecturally.
 */
export class IncomingGroupCallListener {
  private client: Client;

  constructor(accessToken: string | null | undefined, onInvite: (invite: GroupCallInviteMessage) => void) {
    this.client = new Client({
      brokerURL: messagingWebSocketUrl(accessToken),
      reconnectDelay: 3000,
    });
    this.client.onConnect = () => {
      this.client.subscribe('/user/queue/calls', (frame: IMessage) => {
        if (frame.headers['callMessageType'] !== 'group-invite') return;
        onInvite(JSON.parse(frame.body) as GroupCallInviteMessage);
      });
    };
  }

  connect() {
    this.client.activate();
  }

  disconnect() {
    this.client.deactivate();
  }
}
