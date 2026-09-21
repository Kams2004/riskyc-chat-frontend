import type { MessageEnvelope } from '../messaging/api';
import { ChatSocket } from '../messaging/ws';
import type { StatusItem } from './api';

/**
 * Sends a reply to someone's status as a normal 1:1 chat message tagged
 * with replyToStatusId/replyToStatusOwnerId — same mechanism as mobile's
 * status/reply.ts, minus the local SQLite mirror (web has none; the
 * recipient's own thread picks the message up over the wire like any
 * other). A short-lived standalone socket, since the status viewer isn't a
 * conversation screen with an already-open ChatSocket to reuse.
 */
export function sendStatusReply(
  accessToken: string | null | undefined,
  senderId: string,
  status: StatusItem,
  text: string
): Promise<void> {
  const conversationId = [senderId, status.userId].sort().join('_');
  const envelope: MessageEnvelope = {
    messageId: crypto.randomUUID(),
    conversationId,
    senderId,
    recipientId: status.userId,
    ciphertext: text,
    sentAt: new Date().toISOString(),
    replyToStatusId: status.statusId,
    replyToStatusOwnerId: status.userId,
  };

  return new Promise((resolve) => {
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
