import { useCallback, useEffect, useState } from 'react';

import { getGroup } from '../groups/api';
import { getUser } from '../users/api';
import { listConversationSummaries, type ConversationSummary } from './api';
import { otherPartyFrom, UNRESOLVED_TITLE_PLACEHOLDER } from './conversationId';

export type ConversationListItem = {
  conversationId: string;
  title: string;
  avatarObjectKey: string | null;
  isGroup: boolean;
  otherUserId: string | null;
  groupId: string | null;
  lastMessageAt: string;
};

// Session-only — web isn't offline-first, so there's no local store of
// resolved names to fall back on; re-resolving per session (not persisted
// across reloads) is an acceptable tradeoff for a desktop-context client.
const nameCache = new Map<string, { title: string; avatarObjectKey: string | null }>();

async function resolve(summary: ConversationSummary, myUserId: string): Promise<ConversationListItem> {
  const cached = nameCache.get(summary.conversationId);
  if (cached) {
    return {
      conversationId: summary.conversationId,
      title: cached.title,
      avatarObjectKey: cached.avatarObjectKey,
      isGroup: !!summary.groupId,
      otherUserId: summary.otherUserId,
      groupId: summary.groupId,
      lastMessageAt: summary.lastMessageAt,
    };
  }

  let title = UNRESOLVED_TITLE_PLACEHOLDER;
  let avatarObjectKey: string | null = null;
  try {
    if (summary.groupId) {
      const group = await getGroup(summary.groupId);
      title = group.name || UNRESOLVED_TITLE_PLACEHOLDER;
      avatarObjectKey = group.avatarObjectKey;
    } else {
      const otherId = summary.otherUserId ?? otherPartyFrom(summary.conversationId, myUserId);
      const user = await getUser(otherId);
      title = user.displayName || user.phoneNumber || UNRESOLVED_TITLE_PLACEHOLDER;
      avatarObjectKey = user.avatarObjectKey;
    }
    nameCache.set(summary.conversationId, { title, avatarObjectKey });
  } catch {
    // Leave the placeholder title — the list still renders, just unresolved for this item.
  }

  return {
    conversationId: summary.conversationId,
    title,
    avatarObjectKey,
    isGroup: !!summary.groupId,
    otherUserId: summary.otherUserId,
    groupId: summary.groupId,
    lastMessageAt: summary.lastMessageAt,
  };
}

export function useConversationList(myUserId: string | null) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!myUserId) return;
    setIsLoading(true);
    try {
      const summaries = await listConversationSummaries();
      const resolved = await Promise.all(summaries.map((s) => resolve(s, myUserId)));
      resolved.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      setConversations(resolved);
    } catch (e) {
      console.warn('[useConversationList] failed to load conversations', e);
    } finally {
      setIsLoading(false);
    }
  }, [myUserId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { conversations, isLoading, reload };
}
