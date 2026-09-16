import { Client, type IMessage } from '@stomp/stompjs';

import { messagingWebSocketUrl } from '../../lib/config';
import type {
  GroupAckRequest,
  GroupReceiptUpdate,
  MessageDeleteRequest,
  MessageEditRequest,
  MessageEnvelope,
  MessageMutation,
  MessagePinRequest,
  MessageStatusUpdate,
  TypingIndicator,
  TypingUpdate,
} from './api';

/**
 * Same public surface as mobile's ChatSocket (features/messaging/ws.ts) —
 * same STOMP destinations, since it's the same server. Simpler internally:
 * browser WebSocket doesn't have React Native's text-frame NUL-truncation
 * bug, so this uses stompjs's normal `brokerURL` connection (which builds a
 * plain `new WebSocket(url)` itself) instead of a custom binary-frame
 * WebSocketFactory.
 */
export class ChatSocket {
  private client: Client;
  private pending: Array<{ destination: string; body: string }> = [];

  constructor(accessToken?: string | null) {
    this.client = new Client({
      brokerURL: messagingWebSocketUrl(accessToken),
      reconnectDelay: 3000,
    });
  }

  connect(onConnected?: () => void) {
    this.client.onConnect = () => {
      onConnected?.();
      this.flushPending();
    };
    this.client.onStompError = (frame) => {
      console.warn('[ChatSocket] STOMP error', frame.headers['message'], frame.body);
    };
    this.client.activate();
  }

  disconnect() {
    this.client.deactivate();
  }

  subscribeToConversation(conversationId: string, onMessage: (envelope: MessageEnvelope) => void) {
    return this.client.subscribe(`/topic/conversation.${conversationId}`, (frame: IMessage) => {
      onMessage(JSON.parse(frame.body) as MessageEnvelope);
    });
  }

  subscribeToStatusUpdates(conversationId: string, onStatus: (update: MessageStatusUpdate) => void) {
    return this.client.subscribe(`/topic/conversation.${conversationId}.status`, (frame: IMessage) => {
      onStatus(JSON.parse(frame.body) as MessageStatusUpdate);
    });
  }

  subscribeToMutations(conversationId: string, onMutation: (mutation: MessageMutation) => void) {
    return this.client.subscribe(`/topic/conversation.${conversationId}.mutations`, (frame: IMessage) => {
      onMutation(JSON.parse(frame.body) as MessageMutation);
    });
  }

  subscribeToReceipts(conversationId: string, onReceipt: (update: GroupReceiptUpdate) => void) {
    return this.client.subscribe(`/topic/conversation.${conversationId}.receipts`, (frame: IMessage) => {
      onReceipt(JSON.parse(frame.body) as GroupReceiptUpdate);
    });
  }

  subscribeToTyping(conversationId: string, onTyping: (update: TypingUpdate) => void) {
    return this.client.subscribe(`/topic/conversation.${conversationId}.typing`, (frame: IMessage) => {
      onTyping(JSON.parse(frame.body) as TypingUpdate);
    });
  }

  /** Mirrors this account's own read/delivery acks across its other devices — see mobile's identical method and ChatController#ack/#ackGroup. Web doesn't have a persisted unread badge to update yet, but the subscription is here for parity/future use. */
  subscribeToUserReadState(onUpdate: (update: MessageStatusUpdate | GroupReceiptUpdate) => void) {
    return this.client.subscribe('/user/queue/read-state', (frame: IMessage) => {
      onUpdate(JSON.parse(frame.body) as MessageStatusUpdate | GroupReceiptUpdate);
    });
  }

  subscribeToUserQueue(onMessage: (envelope: MessageEnvelope) => void) {
    return this.client.subscribe('/user/queue/messages', (frame: IMessage) => {
      onMessage(JSON.parse(frame.body) as MessageEnvelope);
    });
  }

  subscribeToUserMutations(onMutation: (mutation: MessageMutation) => void) {
    return this.client.subscribe('/user/queue/mutations', (frame: IMessage) => {
      onMutation(JSON.parse(frame.body) as MessageMutation);
    });
  }

  send(envelope: MessageEnvelope) {
    this.enqueue({ destination: '/app/chat.send', body: JSON.stringify(envelope) });
  }

  sendAck(update: MessageStatusUpdate) {
    this.enqueue({ destination: '/app/chat.ack', body: JSON.stringify(update) });
  }

  sendEdit(request: MessageEditRequest) {
    this.enqueue({ destination: '/app/chat.edit', body: JSON.stringify(request) });
  }

  sendDelete(request: MessageDeleteRequest) {
    this.enqueue({ destination: '/app/chat.delete', body: JSON.stringify(request) });
  }

  sendPin(request: MessagePinRequest) {
    this.enqueue({ destination: '/app/chat.pin', body: JSON.stringify(request) });
  }

  sendGroupAck(request: GroupAckRequest) {
    this.enqueue({ destination: '/app/chat.ack.group', body: JSON.stringify(request) });
  }

  sendTyping(indicator: TypingIndicator) {
    if (!this.client.connected) return;
    this.client.publish({ destination: '/app/chat.typing', body: JSON.stringify(indicator) });
  }

  private enqueue(frame: { destination: string; body: string }) {
    if (!this.client.connected) {
      this.pending.push(frame);
      return;
    }
    this.client.publish(frame);
  }

  private flushPending() {
    const queued = this.pending;
    this.pending = [];
    for (const frame of queued) {
      this.client.publish(frame);
    }
  }
}
