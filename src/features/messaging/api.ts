import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';
export type MediaType = 'IMAGE' | 'VIDEO' | 'FILE' | 'AUDIO' | 'CALL';

export type AttachmentItem = {
  position: number;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaObjectKey: string;
  mediaFileName: string | null;
  mediaDurationMs: number | null;
};

export type MessageEnvelope = {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  sentAt: string;
  status?: MessageStatus;
  mediaType?: MediaType | null;
  mediaObjectKey?: string | null;
  mediaFileName?: string | null;
  mediaDurationMs?: number | null;
  edited?: boolean;
  deleted?: boolean;
  groupId?: string | null;
  forwarded?: boolean;
  /** Populated only for a multi-image/video gallery send — see the single mediaType/mediaObjectKey fields above for everything else. */
  attachments?: AttachmentItem[];
  /** All four null/absent for a message that isn't a reply — generated client-side at send time, see Message.java's own comment. */
  replyToMessageId?: string | null;
  replyToConversationId?: string | null;
  replyToSenderId?: string | null;
  replyToSnippet?: string | null;
  /** Shared, per-conversation pin — absent on the envelope built to send (pin is a separate action). */
  pinned?: boolean;
};

export function fetchHistory(conversationId: string): Promise<MessageEnvelope[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}`);
}

export type MediaSummaryItem = { messageId: string; mediaType: string; mediaObjectKey: string; mediaFileName: string | null; sentAt: string | null };

export function getMediaSummary(conversationId: string, types = 'IMAGE,VIDEO,FILE', limit = 50): Promise<MediaSummaryItem[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}/media-summary?types=${types}&limit=${limit}`);
}

export type SearchResult = { messageId: string; senderId: string; ciphertext: string; sentAt: string };

export function searchInConversation(conversationId: string, query: string): Promise<SearchResult[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}/search?q=${encodeURIComponent(query)}`);
}

export type MessageStatusUpdate = { conversationId: string; messageIds: string[]; status: MessageStatus };
export type MessageMutation = { conversationId: string; messageId: string; ciphertext: string | null; edited: boolean; deleted: boolean; pinned: boolean };
export type MessageEditRequest = { conversationId: string; messageId: string; newCiphertext: string };
export type MessageDeleteRequest = { conversationId: string; messageId: string; scope: 'EVERYONE' | 'ME' };
/** Any participant, not just the sender — pin is a per-conversation bookmark, not an authorship right. */
export type MessagePinRequest = { conversationId: string; messageId: string; pinned: boolean };
export type GroupAckRequest = { conversationId: string; messageIds: string[]; status: MessageStatus };
export type GroupReceiptUpdate = { conversationId: string; messageId: string; userId: string; status: MessageStatus };
export type TypingIndicator = { conversationId: string; isTyping: boolean };
export type TypingUpdate = { conversationId: string; userId: string; isTyping: boolean };

export type ConversationSummary = {
  conversationId: string;
  otherUserId: string | null;
  groupId: string | null;
  lastMessageAt: string;
};

export function listConversationSummaries(): Promise<ConversationSummary[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations`);
}
