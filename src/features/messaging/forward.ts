import type { MessageEnvelope } from './api';
import { ChatSocket } from './ws';

export type ForwardTarget = { conversationId: string; recipientId?: string; groupId?: string };

/**
 * Opens its own short-lived socket rather than reusing the source thread's —
 * same reasoning as mobile's forward.ts: a STOMP send isn't tied to what a
 * connection happens to be subscribed to, and the forward picker isn't
 * scoped to any one conversation.
 */
export async function forwardMessage(
  accessToken: string | null | undefined,
  senderId: string,
  source: MessageEnvelope,
  target: ForwardTarget
): Promise<void> {
  const envelope: MessageEnvelope = {
    messageId: crypto.randomUUID(),
    conversationId: target.conversationId,
    senderId,
    recipientId: target.groupId ? '' : (target.recipientId ?? ''),
    groupId: target.groupId,
    ciphertext: source.ciphertext,
    sentAt: new Date().toISOString(),
    mediaType: source.mediaType,
    mediaObjectKey: source.mediaObjectKey,
    mediaFileName: source.mediaFileName,
    mediaDurationMs: source.mediaDurationMs,
    forwarded: true,
  };

  await new Promise<void>((resolve) => {
    const socket = new ChatSocket(accessToken);
    socket.connect(() => {
      socket.send(envelope);
      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 500);
    });
  });
}
