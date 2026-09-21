/**
 * Two purely local, per-device conversation-list preferences, mirroring
 * mobile's own local-only equivalents:
 *  - favorites: mobile's is_favorite is a plain local SQLite column, never
 *    synced to the server (see data/db.ts's setFavorite) — same pattern as
 *    starredMessages.ts here.
 *  - lastViewedAt: mobile derives its "Unread" filter from real per-message
 *    read status in its local SQLite mirror, which web has no equivalent
 *    of (web only pulls a conversation's full history once its thread is
 *    actually opened). A per-conversation "last viewed" timestamp is a
 *    reasonable client-only stand-in: unread = the conversation's
 *    lastMessageAt is newer than the last time this device viewed it.
 */
const FAVORITES_KEY = 'riskyc.favoriteConversationIds';
const LAST_VIEWED_KEY = 'riskyc.lastViewedAt';

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing / storage disabled — not worth surfacing an error for a per-device convenience flag.
  }
}

export function isFavorite(conversationId: string): boolean {
  return readFavorites().has(conversationId);
}

export function toggleFavorite(conversationId: string): boolean {
  const ids = readFavorites();
  const next = !ids.has(conversationId);
  if (next) ids.add(conversationId);
  else ids.delete(conversationId);
  writeFavorites(ids);
  return next;
}

function readLastViewed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_VIEWED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function markConversationViewed(conversationId: string) {
  try {
    const all = readLastViewed();
    all[conversationId] = new Date().toISOString();
    localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(all));
  } catch {
    // Ignored — worst case this conversation just keeps showing as unread.
  }
}

export function isUnread(conversationId: string, lastMessageAt: string): boolean {
  const lastViewed = readLastViewed()[conversationId];
  if (!lastViewed) return true;
  return lastMessageAt > lastViewed;
}
