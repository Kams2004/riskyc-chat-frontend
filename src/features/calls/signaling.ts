import { Client, type IMessage } from '@stomp/stompjs';

import { messagingWebSocketUrl } from '../../lib/config';

export type CallType = 'AUDIO' | 'VIDEO';

export type CallInvite = {
  callId: string;
  fromUserId: string;
  toUserId: string;
  type: CallType;
  sdpOffer: string;
  callerName?: string | null;
};
export type CallAnswer = { callId: string; fromUserId: string; sdpAnswer: string };
export type CallIceCandidate = {
  callId: string;
  fromUserId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};
export type CallEnd = { callId: string; fromUserId: string; reason: string };
export type CallRenegotiateOffer = { callId: string; fromUserId: string; sdpOffer: string };
export type CallUsageReport = { callId: string; bytesSent: number; bytesReceived: number };

type QueuedFrame = { destination: string; body: string };

type Handlers = {
  onInvite?: (invite: CallInvite) => void;
  onAnswer?: (answer: CallAnswer) => void;
  onIce?: (ice: CallIceCandidate) => void;
  onEnd?: (end: CallEnd) => void;
  onRenegotiateOffer?: (offer: CallRenegotiateOffer) => void;
  onRenegotiateAnswer?: (answer: CallAnswer) => void;
};

/**
 * Web port of mobile's features/calls/signaling.ts — same STOMP
 * destinations/message shapes and discriminated /user/queue/calls
 * subscription (see backend CallController#headersFor), same connection
 * pattern as ChatSocket (plain brokerURL, no NUL-frame workaround needed —
 * that's an RN-bridge-specific bug, not a browser WebSocket one, same
 * reasoning already documented in groupCallSignaling.ts). One persistent
 * instance, mounted for the lifetime of a signed-in session (see
 * CallContext).
 */
export class CallSignalingSocket {
  private client: Client;
  private pending: QueuedFrame[] = [];

  constructor(accessToken?: string | null) {
    this.client = new Client({
      brokerURL: messagingWebSocketUrl(accessToken),
      reconnectDelay: 3000,
    });
  }

  connect(handlers: Handlers, onConnected?: () => void) {
    this.client.onConnect = () => {
      this.client.subscribe('/user/queue/calls', (frame: IMessage) => {
        const type = frame.headers['callMessageType'];
        const body = JSON.parse(frame.body);
        switch (type) {
          case 'invite':
            handlers.onInvite?.(body as CallInvite);
            break;
          case 'answer':
            handlers.onAnswer?.(body as CallAnswer);
            break;
          case 'ice':
            handlers.onIce?.(body as CallIceCandidate);
            break;
          case 'end':
            handlers.onEnd?.(body as CallEnd);
            break;
          case 'renegotiate-offer':
            handlers.onRenegotiateOffer?.(body as CallRenegotiateOffer);
            break;
          case 'renegotiate-answer':
            handlers.onRenegotiateAnswer?.(body as CallAnswer);
            break;
        }
      });
      onConnected?.();
      this.flushPending();
    };
    this.client.onStompError = (frame) => {
      console.warn('[CallSignalingSocket] STOMP error', frame.headers['message'], frame.body);
    };
    this.client.activate();
  }

  disconnect() {
    this.client.deactivate();
  }

  sendInvite(invite: Omit<CallInvite, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.invite', body: JSON.stringify(invite) });
  }

  sendAnswer(answer: Omit<CallAnswer, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.answer', body: JSON.stringify(answer) });
  }

  sendIce(ice: Omit<CallIceCandidate, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.ice', body: JSON.stringify(ice) });
  }

  sendEnd(end: Omit<CallEnd, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.end', body: JSON.stringify(end) });
  }

  sendRenegotiateOffer(offer: Omit<CallRenegotiateOffer, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.renegotiate', body: JSON.stringify(offer) });
  }

  sendRenegotiateAnswer(answer: Omit<CallAnswer, 'fromUserId'>) {
    this.enqueue({ destination: '/app/call.renegotiate-answer', body: JSON.stringify(answer) });
  }

  sendUsageReport(report: CallUsageReport) {
    this.enqueue({ destination: '/app/call.report-usage', body: JSON.stringify(report) });
  }

  private enqueue(frame: QueuedFrame) {
    if (!this.client.connected) {
      this.pending.push(frame);
      return;
    }
    this.publish(frame);
  }

  private flushPending() {
    const queued = this.pending;
    this.pending = [];
    for (const frame of queued) {
      this.publish(frame);
    }
  }

  private publish(frame: QueuedFrame) {
    this.client.publish({ destination: frame.destination, body: frame.body });
  }
}
