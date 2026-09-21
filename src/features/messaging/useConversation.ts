import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import * as messagingApi from './api';
import type { MediaType, MessageEnvelope, ReactionRow } from './api';
import { ChatSocket } from './ws';

export type OutgoingMedia = { type: MediaType; objectKey: string; fileName?: string | null; durationMs?: number | null };

export type ReplyToDraft = {
  messageId: string;
  conversationId: string;
  senderId: string;
  snippet: string;
};

export type UseConversationParams = {
  conversationId: string;
  recipientId?: string;
  groupId?: string;
};

/**
 * Web's counterpart to mobile's useConversation — same message flow (send/
 * edit/delete/forward), but no local SQLite: this isn't an offline-first
 * client, so it just keeps messages in React state and re-fetches from the
 * server on mount. Delete-for-me needs no local tracking either — the
 * server's history endpoint already omits anything in the caller's own
 * MessageDeletion rows (see MessageHistoryController), so removing it from
 * this state is a purely optimistic, one-time UI update.
 */
export function useConversation({ conversationId, recipientId, groupId }: UseConversationParams) {
  const { userId, accessToken } = useAuth();
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [muted, setMutedState] = useState(false);
  const [disappearingSeconds, setDisappearingSecondsState] = useState<number | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const isGroup = !!groupId;

  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef(false);
  const typingExpiryRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const TYPING_IDLE_MS = 2500;
  const TYPING_EXPIRY_MS = 6000;

  const upsert = useCallback((envelope: MessageEnvelope) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.messageId === envelope.messageId);
      if (idx === -1) return [...prev, envelope].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
      const next = prev.slice();
      next[idx] = envelope;
      return next;
    });
  }, []);

  const ackIfNotMine = useCallback(
    (messageId: string, senderId: string, recipient: string) => {
      if (senderId === userId) return;
      if (isGroup) {
        socketRef.current?.sendGroupAck({ conversationId, messageIds: [messageId], status: 'READ' });
      } else if (recipient === userId) {
        socketRef.current?.sendAck({ conversationId, messageIds: [messageId], status: 'READ' });
      }
    },
    [conversationId, isGroup, userId]
  );

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setReactions([]);
    setMutedState(false);
    setDisappearingSecondsState(null);

    messagingApi
      .fetchHistory(conversationId)
      .then((history) => {
        if (cancelled) return;
        setMessages(history.slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt)));
        for (const envelope of history) {
          ackIfNotMine(envelope.messageId, envelope.senderId, envelope.recipientId);
        }
      })
      .catch((e) => console.warn('[useConversation] fetchHistory failed', e));

    messagingApi
      .fetchReactions(conversationId)
      .then((rows) => {
        if (!cancelled) setReactions(rows);
      })
      .catch((e) => console.warn('[useConversation] fetchReactions failed', e));

    messagingApi
      .fetchConversationSettings(conversationId)
      .then((settings) => {
        if (cancelled) return;
        setMutedState(settings.muted);
        setDisappearingSecondsState(settings.disappearingMessageSeconds);
      })
      .catch((e) => console.warn('[useConversation] fetchConversationSettings failed', e));

    const socket = new ChatSocket(accessToken);
    socketRef.current = socket;
    socket.connect(() => {
      socket.subscribeToConversation(conversationId, (envelope) => {
        upsert(envelope);
        ackIfNotMine(envelope.messageId, envelope.senderId, envelope.recipientId);
      });

      socket.subscribeToMutations(conversationId, (mutation) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === mutation.messageId
              ? { ...m, ciphertext: mutation.ciphertext ?? m.ciphertext, edited: mutation.edited, deleted: mutation.deleted, pinned: mutation.pinned }
              : m
          )
        );
      });

      if (isGroup) {
        socket.subscribeToReceipts(conversationId, () => {
          // Web doesn't render per-member read receipts in this pass — the
          // aggregate Message.status the server already recomputes (see
          // ChatController#recomputeGroupAggregateStatus) is enough for the
          // tick display here, so this subscription just avoids leaving
          // group-message status stuck if group support is extended later.
        });
      } else {
        socket.subscribeToStatusUpdates(conversationId, (update) => {
          setMessages((prev) =>
            prev.map((m) => (update.messageIds.includes(m.messageId) ? { ...m, status: update.status } : m))
          );
        });
      }

      socket.subscribeToTyping(conversationId, (update) => {
        if (cancelled || update.userId === userId) return;
        const timers = typingExpiryRef.current;
        const existing = timers.get(update.userId);
        if (existing) clearTimeout(existing);
        if (update.isTyping) {
          timers.set(
            update.userId,
            setTimeout(() => {
              timers.delete(update.userId);
              setTypingUserIds((prev) => prev.filter((id) => id !== update.userId));
            }, TYPING_EXPIRY_MS)
          );
          setTypingUserIds((prev) => (prev.includes(update.userId) ? prev : [...prev, update.userId]));
        } else {
          timers.delete(update.userId);
          setTypingUserIds((prev) => prev.filter((id) => id !== update.userId));
        }
      });

      socket.subscribeToReactions(conversationId, (update) => {
        setReactions((prev) => {
          const withoutThisUser = prev.filter((r) => !(r.messageId === update.messageId && r.userId === update.userId));
          if (update.emoji === null) return withoutThisUser;
          return [...withoutThisUser, { messageId: update.messageId, userId: update.userId, emoji: update.emoji }];
        });
      });

      socket.subscribeToSettings(conversationId, (update) => {
        setDisappearingSecondsState(update.seconds);
      });
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      for (const timer of typingExpiryRef.current.values()) clearTimeout(timer);
      typingExpiryRef.current.clear();
      if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
      isTypingSentRef.current = false;
      setTypingUserIds([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, conversationId, groupId, isGroup, userId]);

  const notifyTyping = useCallback(() => {
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    if (!isTypingSentRef.current) {
      isTypingSentRef.current = true;
      socketRef.current?.sendTyping({ conversationId, isTyping: true });
    }
    typingIdleTimerRef.current = setTimeout(() => {
      isTypingSentRef.current = false;
      socketRef.current?.sendTyping({ conversationId, isTyping: false });
    }, TYPING_IDLE_MS);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    if (isTypingSentRef.current) {
      isTypingSentRef.current = false;
      socketRef.current?.sendTyping({ conversationId, isTyping: false });
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    (plaintext: string, media?: OutgoingMedia, forwarded = false, attachments?: OutgoingMedia[], replyTo?: ReplyToDraft) => {
      if (!userId) throw new Error('Cannot send a message while signed out');
      const attachmentDtos =
        attachments && attachments.length > 0
          ? attachments.map((a, i) => ({
              position: i,
              mediaType: a.type as 'IMAGE' | 'VIDEO',
              mediaObjectKey: a.objectKey,
              mediaFileName: a.fileName ?? null,
              mediaDurationMs: a.durationMs ?? null,
            }))
          : undefined;
      const envelope: MessageEnvelope = {
        messageId: crypto.randomUUID(),
        conversationId,
        senderId: userId,
        recipientId: isGroup ? '' : (recipientId ?? ''),
        groupId,
        ciphertext: plaintext,
        sentAt: new Date().toISOString(),
        mediaType: media?.type,
        mediaObjectKey: media?.objectKey,
        mediaFileName: media?.fileName,
        mediaDurationMs: media?.durationMs,
        forwarded,
        attachments: attachmentDtos,
        replyToMessageId: replyTo?.messageId ?? null,
        replyToConversationId: replyTo?.conversationId ?? null,
        replyToSenderId: replyTo?.senderId ?? null,
        replyToSnippet: replyTo?.snippet ?? null,
      };
      upsert(envelope);
      stopTyping();
      socketRef.current?.send(envelope);
    },
    [conversationId, groupId, isGroup, recipientId, stopTyping, upsert]
  );

  /** Toggles a message's shared pin — optimistic local update, then synced via /chat.pin. */
  const pinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, pinned } : m)));
      socketRef.current?.sendPin({ conversationId, messageId, pinned });
    },
    [conversationId]
  );

  const editMessage = useCallback((messageId: string, newText: string) => {
    setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, ciphertext: newText, edited: true } : m)));
    socketRef.current?.sendEdit({ conversationId, messageId, newCiphertext: newText });
  }, [conversationId]);

  /** 'me' removes it from this device's view only (never broadcast — see ChatController#delete); 'everyone' is sender-only and syncs to every participant. */
  const deleteMessage = useCallback(
    (messageId: string, scope: 'everyone' | 'me') => {
      if (scope === 'me') {
        setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
        socketRef.current?.sendDelete({ conversationId, messageId, scope: 'ME' });
        return;
      }
      setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, ciphertext: '', deleted: true } : m)));
      socketRef.current?.sendDelete({ conversationId, messageId, scope: 'EVERYONE' });
    },
    [conversationId]
  );

  /** Toggling the caller's own emoji on a message — sending the SAME emoji again removes it (see ChatController#react); optimistic local update mirrors what the reaction subscription would echo back. */
  const sendReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!userId) return;
      setReactions((prev) => {
        const existing = prev.find((r) => r.messageId === messageId && r.userId === userId);
        const withoutThisUser = prev.filter((r) => !(r.messageId === messageId && r.userId === userId));
        if (existing && existing.emoji === emoji) return withoutThisUser;
        return [...withoutThisUser, { messageId, userId, emoji }];
      });
      socketRef.current?.sendReaction({ messageId, conversationId, emoji });
    },
    [conversationId, userId]
  );

  const setMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      messagingApi.setConversationMuted(conversationId, next).catch((e) => console.warn('[useConversation] setMuted failed', e));
    },
    [conversationId]
  );

  const setDisappearing = useCallback(
    (seconds: number | null) => {
      setDisappearingSecondsState(seconds);
      messagingApi.setDisappearingMessages(conversationId, seconds).catch((e) => console.warn('[useConversation] setDisappearing failed', e));
    },
    [conversationId]
  );

  return {
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    typingUserIds,
    notifyTyping,
    reactions,
    sendReaction,
    muted,
    setMuted,
    disappearingSeconds,
    setDisappearing,
  };
}
