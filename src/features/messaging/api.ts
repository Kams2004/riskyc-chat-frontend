import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';
export type MediaType = 'IMAGE' | 'VIDEO' | 'FILE' | 'AUDIO' | 'CALL' | 'STICKER';

export type AttachmentItem = {
  position: number;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaObjectKey: string;
  mediaFileName: string | null;
  mediaDurationMs: number | null;
  /** Bytes, client-supplied at send time — feeds the combined-size download gate shown before a multi-item gallery has been fetched. Null for an item sent before this field existed. */
  mediaFileSize?: number | null;
  /** Opaque drawing/text-overlay JSON for an IMAGE gallery item — see lib/overlay.ts. Null for a VIDEO item or one without an overlay. */
  overlayJson?: string | null;
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
  /** Comma-separated normalized amplitude samples (0-100 ints) for an AUDIO message, captured live during recording on mobile — null for a web-recorded voice message (web derives its waveform by decoding the audio client-side instead, see VoiceMessagePlayer) or one sent before this field existed. */
  waveform?: string | null;
  /** Opaque drawing/text-overlay JSON for an IMAGE message — see lib/overlay.ts. Null for every message without one. */
  overlayJson?: string | null;
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
  /** Set only for a group-call log entry (mediaType=CALL, groupId set) — participant count for that call. */
  mediaParticipantCount?: number | null;
  /** Set only when the conversation had disappearing messages on at send time. */
  expiresAt?: string | null;
  /** True for a group event log line ("X joined the group"), never something a person typed. */
  system?: boolean;
  /** Both null/absent unless this message is a reply to a status. */
  replyToStatusId?: string | null;
  replyToStatusOwnerId?: string | null;
  /** Bytes — single-attachment path's counterpart to AttachmentItem.mediaFileSize, feeds the auto-download-off download gate's size label. Null/absent for a message sent before this field existed. */
  mediaFileSize?: number | null;
};

/**
 * since/until (both optional, ISO instants) bound the fetch to a time
 * window — used for the web client's 24h-initial / 12h-increment message
 * paging (see useConversation.ts). Omitting both keeps the old unbounded
 * full-history behavior.
 */
export function fetchHistory(conversationId: string, since?: string, until?: string): Promise<MessageEnvelope[]> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (until) params.set('until', until);
  const query = params.toString();
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}${query ? `?${query}` : ''}`);
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
  muted: boolean;
  disappearingMessageSeconds: number | null;
};

export function listConversationSummaries(): Promise<ConversationSummary[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations`);
}

export type ConversationSettingsResult = { muted: boolean; disappearingMessageSeconds: number | null; autoDownloadMedia: boolean };

/** The thread's own initial fetch for mute/disappearing/auto-download state — same endpoint mobile uses. */
export function fetchConversationSettings(conversationId: string): Promise<ConversationSettingsResult> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations/${conversationId}/settings`);
}

export function setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations/${conversationId}/mute`, {
    method: 'PUT',
    body: JSON.stringify({ muted }),
  });
}

/** seconds=null turns disappearing messages off. Applies only to messages sent from now on. */
export function setDisappearingMessages(conversationId: string, seconds: number | null): Promise<void> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations/${conversationId}/disappearing`, {
    method: 'PUT',
    body: JSON.stringify({ seconds }),
  });
}

/** Per-viewer, per-conversation — see AutoDownloadDisabled's own doc comment backend-side. false gates every image/video (not just multi-item galleries) behind the tap-to-download button. */
export function setAutoDownloadMedia(conversationId: string, autoDownloadMedia: boolean): Promise<void> {
  return apiFetch(`${config.messagingServiceUrl}/api/conversations/${conversationId}/auto-download`, {
    method: 'PUT',
    body: JSON.stringify({ autoDownloadMedia }),
  });
}

export type ReactionRow = { messageId: string; userId: string; emoji: string };

/** Bulk, one call per thread open — feeds initial reaction state; live updates arrive over the .reactions STOMP topic afterward. */
export function fetchReactions(conversationId: string): Promise<ReactionRow[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}/reactions`);
}

export type ReceiptRow = { userId: string; status: MessageStatus };

/** On-demand "Message info" fetch — web isn't offline-first, so unlike mobile (which accumulates receipts locally over the live STOMP stream) this fetches the current picture directly. */
export function fetchMessageReceipts(conversationId: string, messageId: string): Promise<ReceiptRow[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/messages/${conversationId}/${messageId}/receipts`);
}

export type LinkPreview = { url: string; title: string | null; description: string | null; imageUrl: string | null; siteName: string | null };

export function fetchLinkPreview(url: string): Promise<LinkPreview> {
  return apiFetch(`${config.messagingServiceUrl}/api/link-preview?url=${encodeURIComponent(url)}`);
}
