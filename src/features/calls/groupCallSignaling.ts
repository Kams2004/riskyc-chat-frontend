import { sfuWebSocketUrl } from '../../lib/config';

export type GroupCallType = 'AUDIO' | 'VIDEO';

type PendingRequest = {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

export type GroupCallNotificationHandlers = {
  onPeerJoined?: (data: { peerId: string; displayName: string }) => void;
  onPeerLeft?: (data: { peerId: string }) => void;
  onNewProducer?: (data: { peerId: string; displayName: string; producerId: string; kind: 'audio' | 'video' }) => void;
  onProducerClosed?: (data: { producerId: string }) => void;
};

/**
 * Same hand-rolled protoo-wire client as mobile's groupCallSignaling.ts —
 * kept as near-identical code on both platforms rather than sharing a
 * package, since this app has no shared-code build setup between
 * mobile/web. Simpler than mobile's version: browser WebSocket has no
 * NUL-frame-truncation bug to work around (see ChatSocket's own comment on
 * why mobile needs that).
 */
export class GroupCallSignalingSocket {
  private ws: WebSocket | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private handlers: GroupCallNotificationHandlers = {};

  connect(
    accessToken: string | null | undefined,
    groupId: string,
    displayName: string,
    callType: GroupCallType,
    handlers: GroupCallNotificationHandlers,
    onOpen: () => void,
    onDisconnected: (reason: string) => void
  ) {
    this.handlers = handlers;
    const url = sfuWebSocketUrl(accessToken, groupId, displayName, callType);
    // The 'protoo' subprotocol is required — protoo-server's WebSocketServer rejects the handshake (403) without it.
    const ws = new WebSocket(url, 'protoo');
    this.ws = ws;

    ws.onopen = () => onOpen();
    ws.onmessage = (event) => this.handleMessage(String(event.data));
    ws.onerror = (event) => console.warn('[GroupCallSignalingSocket] error', event);
    ws.onclose = (event) => {
      this.rejectAllPending(new Error('Connection closed'));
      onDisconnected(event.reason || `code ${event.code}`);
    };
  }

  disconnect() {
    this.rejectAllPending(new Error('Disconnected'));
    this.ws?.close();
    this.ws = null;
  }

  request(method: string, data: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      const id = this.nextRequestId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ request: true, id, method, data }));
    });
  }

  private handleMessage(raw: string) {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.response) {
      const id = message.id as number;
      const pending = this.pendingRequests.get(id);
      if (!pending) return;
      this.pendingRequests.delete(id);
      if (message.ok) {
        pending.resolve((message.data as Record<string, unknown>) ?? {});
      } else {
        pending.reject(new Error(`${message.errorCode}: ${message.errorReason}`));
      }
      return;
    }

    if (message.notification) {
      const data = (message.data as Record<string, unknown>) ?? {};
      switch (message.method) {
        case 'peerJoined':
          this.handlers.onPeerJoined?.(data as { peerId: string; displayName: string });
          break;
        case 'peerLeft':
          this.handlers.onPeerLeft?.(data as { peerId: string });
          break;
        case 'newProducer':
          this.handlers.onNewProducer?.(data as { peerId: string; displayName: string; producerId: string; kind: 'audio' | 'video' });
          break;
        case 'producerClosed':
          this.handlers.onProducerClosed?.(data as { producerId: string });
          break;
      }
    }
  }

  private rejectAllPending(error: Error) {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
